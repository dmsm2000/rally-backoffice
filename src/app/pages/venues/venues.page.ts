import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import {
  TONE_CLASSES,
  VENUE_KINDS,
  daysSince,
  formatDate,
  formatDateTime,
  mapsUrl,
  memberNumber,
  timeAgo
} from '../../core/format';
import { Venue } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Icon } from '../../ui/icon';
import { PageHeader } from '../../ui/page-header';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, CARD, PILL } from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

type Filter = 'all' | 'verified' | 'drafts' | 'stale';

/** Rally's design says an unconfirmed venue should stop being offered after ~60 days; nothing enforces it yet. */
const STALE_DRAFT_DAYS = 60;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'verified', label: 'Verificados' },
  { key: 'drafts', label: 'Rascunhos' },
  { key: 'stale', label: 'Rascunhos antigos' }
];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

@Component({
  selector: 'bo-venues-page',
  imports: [FormsModule, RouterLink, Icon, PageHeader, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './venues.page.html'
})
export class VenuesPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Bound from the `?filter=` query param, so the dashboard can link straight to stale drafts. */
  readonly filterParam = input<string>(undefined, { alias: 'filter' });

  protected readonly rows = signal<Venue[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly bulk = signal<{ done: number; total: number } | null>(null);

  protected readonly filters = FILTERS;
  protected readonly filter = computed<Filter>(() => FILTERS.find(f => f.key === this.filterParam())?.key ?? 'all');

  protected readonly counts = computed(() => {
    const rows = this.rows() ?? [];
    return {
      all: rows.length,
      verified: rows.filter(v => v.status === 'live').length,
      drafts: rows.filter(v => v.status === 'draft').length,
      stale: rows.filter(v => this.isStale(v)).length
    } satisfies Record<Filter, number>;
  });

  protected readonly visible = computed(() => {
    const rows = this.rows();
    if (!rows) {
      return null;
    }
    const filter = this.filter();
    const query = normalize(this.search().trim());
    return rows.filter(venue => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'verified' && venue.status === 'live') ||
        (filter === 'drafts' && venue.status === 'draft') ||
        (filter === 'stale' && this.isStale(venue));
      return matchesFilter && (!query || normalize(`${venue.name} ${venue.city} ${venue.country}`).includes(query));
    });
  });

  protected readonly kinds = VENUE_KINDS;
  protected readonly tones = TONE_CLASSES;
  protected readonly ago = timeAgo;
  protected readonly date = formatDate;
  protected readonly dateTime = formatDateTime;
  protected readonly days = daysSince;
  protected readonly member = memberNumber;
  protected readonly mapsUrl = mapsUrl;
  protected readonly round = Math.round;
  protected readonly staleDays = STALE_DRAFT_DAYS;
  protected readonly styles = { card: CARD, pill: PILL, ghost: BTN_GHOST, primary: BTN_PRIMARY, danger: BTN_DANGER };

  constructor() {
    void this.load();
  }

  protected isStale(venue: Venue): boolean {
    return venue.status === 'draft' && daysSince(venue.created_at) > STALE_DRAFT_DAYS;
  }

  protected setFilter(filter: Filter): void {
    void this.router.navigate([], { queryParams: { filter: filter === 'all' ? null : filter }, replaceUrl: true });
  }

  protected async load(): Promise<void> {
    this.error.set(null);
    try {
      this.rows.set(await this.api.venues());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }

  protected async deleteVenue(venue: Venue): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Apagar ${venue.name}?`,
      message: `${venue.city}, ${venue.country}. Não dá para desfazer.`,
      details: [
        `${venue.court_count} ${venue.court_count === 1 ? 'campo' : 'campos'}, com fotos, denúncias e ${venue.capture_total} ${venue.capture_total === 1 ? 'captura' : 'capturas'}.`,
        venue.status === 'live' ? 'O anúncio do local no feed.' : 'Ainda é um rascunho — ninguém o vê além de quem o registou.',
        'As partidas marcadas lá continuam, sem campo associado.'
      ],
      confirmLabel: 'Apagar local',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(venue.id);
    try {
      const outcome = await this.api.deleteVenue(venue.id);
      this.rows.update(rows => rows?.filter(row => row.id !== venue.id) ?? null);
      this.toast.ok(`Local apagado: ${venue.name}.`);
      if (outcome.filesLeft) {
        this.toast.warn(`${outcome.filesLeft} ${outcome.filesLeft === 1 ? 'foto ficou' : 'fotos ficaram'} no Storage.`);
      }
      void this.store.refresh();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async deleteStaleDrafts(): Promise<void> {
    const targets = (this.rows() ?? []).filter(venue => this.isStale(venue));
    if (!targets.length) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: `Apagar ${targets.length} ${targets.length === 1 ? 'rascunho antigo' : 'rascunhos antigos'}?`,
      message: `Locais por confirmar há mais de ${STALE_DRAFT_DAYS} dias. Um de cada vez, cada um fica no histórico.`,
      details: targets.slice(0, 6).map(v => `${v.name} · ${v.city} · há ${daysSince(v.created_at)} dias`).concat(
        targets.length > 6 ? [`…e mais ${targets.length - 6}`] : []
      ),
      confirmLabel: 'Apagar todos',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    let failed = 0;
    let filesLeft = 0;
    this.bulk.set({ done: 0, total: targets.length });
    for (const venue of targets) {
      try {
        filesLeft += (await this.api.deleteVenue(venue.id)).filesLeft;
        this.rows.update(rows => rows?.filter(row => row.id !== venue.id) ?? null);
      } catch {
        failed++;
      }
      this.bulk.update(progress => (progress ? { ...progress, done: progress.done + 1 } : null));
    }
    this.bulk.set(null);
    const deleted = targets.length - failed;
    if (deleted) {
      this.toast.ok(`${deleted} ${deleted === 1 ? 'rascunho apagado' : 'rascunhos apagados'}.`);
    }
    if (failed) {
      this.toast.warn(`${failed} não ${failed === 1 ? 'foi apagado' : 'foram apagados'} — atualiza e tenta outra vez.`);
    }
    if (filesLeft) {
      this.toast.warn(`${filesLeft} ${filesLeft === 1 ? 'foto ficou' : 'fotos ficaram'} no Storage.`);
    }
    void this.store.refresh();
  }
}
