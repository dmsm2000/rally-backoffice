import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import {
  COURT_REASONS,
  SURFACES,
  TONE_CLASSES,
  VENUE_KINDS,
  appUrl,
  courtLabel,
  formatDateTime,
  mapsUrl,
  timeAgo
} from '../../core/format';
import { CourtReport, ReportGroup, Resolution, groupReports } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Icon } from '../../ui/icon';
import { PageHeader } from '../../ui/page-header';
import { ReportList } from '../../ui/report-list';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import {
  BTN_DANGER,
  BTN_GHOST,
  BTN_LINK,
  BTN_OK,
  CARD,
  PILL,
  SEGMENT,
  SEGMENTED,
  SEGMENT_ACTIVE,
  SEGMENT_IDLE
} from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

type Tab = 'open' | 'resolved';

@Component({
  selector: 'bo-court-reports-page',
  imports: [RouterLink, Icon, PageHeader, ReportList, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './court-reports.page.html'
})
export class CourtReportsPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly tab = signal<Tab>('open');
  protected readonly rows = signal<CourtReport[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly reason = signal<string | null>(null);
  /** The court currently being acted on — its buttons disable, the rest stay usable. */
  protected readonly busy = signal<string | null>(null);

  protected readonly reasonOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const row of this.rows() ?? []) {
      counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
    }
    return Object.entries(COURT_REASONS)
      .filter(([key]) => counts.has(key))
      .map(([key, meta]) => ({ key, label: meta?.label ?? key, count: counts.get(key) ?? 0 }));
  });

  protected readonly groups = computed(() => {
    const rows = this.rows();
    if (!rows) {
      return null;
    }
    const reason = this.reason();
    const courtIds = reason ? new Set(rows.filter(r => r.reason === reason).map(r => r.court_id)) : null;
    return groupReports(courtIds ? rows.filter(r => courtIds.has(r.court_id)) : rows, r => r.court_id);
  });

  protected readonly reasons = COURT_REASONS;
  protected readonly surfaces = SURFACES;
  protected readonly kinds = VENUE_KINDS;
  protected readonly tones = TONE_CLASSES;
  protected readonly courtLabel = courtLabel;
  protected readonly mapsUrl = mapsUrl;
  protected readonly ago = timeAgo;
  protected readonly dateTime = formatDateTime;
  protected readonly round = Math.round;
  protected readonly styles = {
    card: CARD,
    pill: PILL,
    ghost: BTN_GHOST,
    ok: BTN_OK,
    danger: BTN_DANGER,
    link: BTN_LINK,
    segmented: SEGMENTED,
    segment: SEGMENT,
    segmentActive: SEGMENT_ACTIVE,
    segmentIdle: SEGMENT_IDLE
  };

  constructor() {
    effect(() => {
      const tab = this.tab();
      untracked(() => void this.load(tab));
    });
  }

  protected setTab(tab: Tab): void {
    this.reason.set(null);
    this.tab.set(tab);
  }

  protected toggleReason(reason: string): void {
    this.reason.update(current => (current === reason ? null : reason));
  }

  protected courtUrl(courtId: string): string {
    return appUrl(`/courts/${courtId}`);
  }

  protected async reload(): Promise<void> {
    await this.load(this.tab());
  }

  protected async resolve(group: ReportGroup<CourtReport>, resolution: Resolution): Promise<void> {
    this.busy.set(group.key);
    try {
      const count = await this.api.resolveCourtReports(group.key, resolution);
      this.toast.ok(
        resolution === 'dismissed'
          ? `${count === 1 ? 'Denúncia ignorada' : `${count} denúncias ignoradas`} — ${group.first.venue_name}.`
          : `${count === 1 ? 'Denúncia marcada' : `${count} denúncias marcadas`} como tratada${count === 1 ? '' : 's'}.`
      );
      this.dropCourt(group.key);
      void this.store.refresh();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async deleteCourt(group: ReportGroup<CourtReport>): Promise<void> {
    const r = group.first;
    const court = courtLabel(r.court_number);
    const lastCourt = r.venue_court_count <= 1;
    const confirmed = await this.confirm.ask({
      title: `Apagar ${court}?`,
      message: `${court} em ${r.venue_name}, ${r.venue_city}. Não dá para desfazer.`,
      details: [
        lastCourt
          ? `É o único campo de ${r.venue_name}: o local também é apagado, com o anúncio no feed.`
          : `${r.venue_name} fica com ${r.venue_court_count - 1} ${r.venue_court_count - 1 === 1 ? 'campo' : 'campos'}.`,
        `${r.court_capture_count} ${r.court_capture_count === 1 ? 'captura sai' : 'capturas saem'} dos passaportes.`,
        'As fotos e as denúncias deste campo são apagadas (fica registo no histórico).'
      ],
      confirmLabel: lastCourt ? 'Apagar campo e local' : 'Apagar campo',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(group.key);
    try {
      const outcome = await this.api.deleteCourt(group.key);
      this.toast.ok(outcome.venueDeleted ? `${court} e ${r.venue_name} apagados.` : `${court} apagado.`);
      this.warnFilesLeft(outcome.filesLeft);
      await this.reload();
      void this.store.refresh();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async deleteVenue(group: ReportGroup<CourtReport>): Promise<void> {
    const r = group.first;
    const confirmed = await this.confirm.ask({
      title: `Apagar ${r.venue_name}?`,
      message: `O local inteiro em ${r.venue_city}, ${r.venue_country}. Não dá para desfazer.`,
      details: [
        `${r.venue_court_count} ${r.venue_court_count === 1 ? 'campo' : 'campos'}, com as fotos, capturas e denúncias de todos.`,
        'O anúncio do local no feed.',
        'As partidas marcadas lá continuam, sem campo associado.'
      ],
      confirmLabel: 'Apagar local',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(group.key);
    try {
      const outcome = await this.api.deleteVenue(r.venue_id);
      this.toast.ok(`Local apagado: ${r.venue_name} (${outcome.courts} ${outcome.courts === 1 ? "campo" : "campos"}).`);
      this.warnFilesLeft(outcome.filesLeft);
      await this.reload();
      void this.store.refresh();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  private async load(tab: Tab): Promise<void> {
    this.rows.set(null);
    this.error.set(null);
    try {
      const rows = await this.api.courtReports(tab === 'open');
      if (this.tab() === tab) {
        this.rows.set(rows);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }

  private dropCourt(courtId: string): void {
    this.rows.update(rows => rows?.filter(row => row.court_id !== courtId) ?? null);
    if (this.reason() && !this.rows()?.some(row => row.reason === this.reason())) {
      this.reason.set(null);
    }
  }

  private warnFilesLeft(count: number): void {
    if (count) {
      this.toast.warn(`${count} ${count === 1 ? 'foto ficou' : 'fotos ficaram'} no Storage — remove à mão se quiseres.`);
    }
  }
}
