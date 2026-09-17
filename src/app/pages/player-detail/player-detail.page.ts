import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import { TONE_CLASSES, appUrl, formatDate, formatDateTime, initials, memberNumber, timeAgo } from '../../core/format';
import { PlayerDetail } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Dialog } from '../../ui/dialog';
import { Icon, IconName } from '../../ui/icon';
import { PlaceFields } from '../../ui/place-fields';
import { ErrorState } from '../../ui/state-panels';
import { BTN_DANGER, BTN_GHOST, BTN_LINK, BTN_PRIMARY, BTN_WARN, CARD, INPUT, LABEL, PILL } from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

interface Draft {
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  bio: string;
}

interface Stat {
  label: string;
  value: number;
  icon: IconName;
  link?: { path: string; params?: Partial<Record<string, string>> };
  alert?: boolean;
}

@Component({
  selector: 'bo-player-detail-page',
  imports: [FormsModule, RouterLink, Icon, Dialog, PlaceFields, ErrorState],
  templateUrl: './player-detail.page.html'
})
export class PlayerDetailPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly player = signal<PlayerDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly draft = signal<Draft>({ firstName: '', lastName: '', country: '', city: '', bio: '' });
  protected readonly blockOpen = signal(false);
  protected readonly blockReason = signal('');

  protected readonly dirty = computed(() => {
    const p = this.player();
    const d = this.draft();
    return (
      !!p &&
      (d.firstName !== p.first_name ||
        d.lastName !== p.last_name ||
        d.country !== (p.country ?? '') ||
        d.city !== (p.city ?? '') ||
        d.bio !== (p.bio ?? ''))
    );
  });

  protected readonly stats = computed((): Stat[] => {
    const p = this.player();
    if (!p) {
      return [];
    }
    const c = p.counts;
    return [
      { label: 'Publicações', value: c.posts, icon: 'image', link: { path: '/posts', params: { author: p.id } } },
      { label: 'Gostos recebidos', value: c.likes_received, icon: 'check' },
      { label: 'Partidas', value: c.matches, icon: 'matches', link: { path: '/matches', params: { player: p.id } } },
      { label: 'Partidas terminadas', value: c.matches_complete, icon: 'tennis-ball' },
      { label: 'Viagens', value: c.trips, icon: 'world', link: { path: '/trips', params: { player: p.id } } },
      { label: 'Capturas', value: c.captures, icon: 'courts' },
      { label: 'Locais registados', value: c.venues, icon: 'map-pin' },
      { label: 'Fotos de campos', value: c.photos, icon: 'camera' },
      {
        label: 'Denúncias abertas contra',
        value: c.open_reports_against,
        icon: 'flag',
        link: { path: '/posts', params: { author: p.id, filter: 'reported' } },
        alert: c.open_reports_against > 0
      },
      { label: 'Denúncias feitas', value: c.reports_filed, icon: 'note' }
    ];
  });

  protected readonly tones = TONE_CLASSES;
  protected readonly styles = {
    card: CARD,
    pill: PILL,
    ghost: BTN_GHOST,
    primary: BTN_PRIMARY,
    danger: BTN_DANGER,
    warn: BTN_WARN,
    link: BTN_LINK,
    input: INPUT,
    label: LABEL
  };
  protected readonly member = memberNumber;
  protected readonly initials = initials;
  protected readonly date = formatDate;
  protected readonly dateTime = formatDateTime;
  protected readonly ago = timeAgo;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  protected appProfileUrl(id: string): string {
    return appUrl(`/players/${id}`);
  }

  protected patch(change: Partial<Draft>): void {
    this.draft.update(draft => ({ ...draft, ...change }));
  }

  protected reset(): void {
    const p = this.player();
    if (p) {
      this.draft.set({ firstName: p.first_name, lastName: p.last_name, country: p.country ?? '', city: p.city ?? '', bio: p.bio ?? '' });
    }
  }

  protected async save(): Promise<void> {
    const p = this.player();
    if (!p || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.api.updatePlayer(p.id, this.draft());
      this.toast.ok('Perfil guardado.');
      await this.load(p.id);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected openBlock(): void {
    this.blockReason.set('');
    this.blockOpen.set(true);
  }

  protected async block(): Promise<void> {
    const p = this.player();
    if (!p || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.api.blockPlayer(p.id, this.blockReason().trim());
      this.blockOpen.set(false);
      this.toast.ok(`Conta de ${p.first_name} ${p.last_name} bloqueada.`);
      void this.store.refresh();
      await this.load(p.id);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async unblock(): Promise<void> {
    const p = this.player();
    if (!p) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: `Desbloquear ${p.first_name} ${p.last_name}?`,
      message: 'A conta volta a conseguir entrar na app.',
      confirmLabel: 'Desbloquear'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    try {
      await this.api.unblockPlayer(p.id);
      this.toast.ok('Conta desbloqueada.');
      void this.store.refresh();
      await this.load(p.id);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const p = this.player();
    if (!p) {
      return;
    }
    const c = p.counts;
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const confirmed = await this.confirm.ask({
      title: `Apagar ${p.first_name} ${p.last_name}?`,
      message: `A conta ${p.email ?? ''} deixa de existir. Não dá para desfazer — se só queres impedir a entrada, bloqueia.`,
      details: [
        `${plural(c.posts, 'publicação', 'publicações')}, com fotos e vídeos, ${plural(c.trips, 'viagem', 'viagens')} e ${plural(c.matches, 'partida', 'partidas')} (também para os outros jogadores dessas partidas).`,
        'As conversas privadas desta pessoa também desaparecem, para os dois lados.',
        `Ficam, sem autor: ${plural(c.venues, 'local registado', 'locais registados')}, ${plural(c.photos, 'foto de campo', 'fotos de campos')} e as denúncias que fez.`
      ],
      confirmLabel: 'Apagar conta',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    try {
      const outcome = await this.api.deletePlayer(p.id);
      this.toast.ok(`A conta de ${p.first_name} ${p.last_name} foi apagada.`);
      if (outcome.filesLeft) {
        this.toast.warn(`${outcome.filesLeft} ${outcome.filesLeft === 1 ? 'ficheiro ficou' : 'ficheiros ficaram'} no Storage.`);
      }
      void this.store.refresh();
      void this.router.navigateByUrl('/players');
    } catch (error) {
      this.toast.error(error);
      this.busy.set(false);
    }
  }

  protected async load(id: string): Promise<void> {
    this.error.set(null);
    try {
      const player = await this.api.player(id);
      if (id === this.id()) {
        this.player.set(player);
        this.reset();
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}
