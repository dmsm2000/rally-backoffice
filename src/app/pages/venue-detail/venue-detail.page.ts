import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import {
  ACCESS_OPTIONS,
  SURFACES,
  TONE_CLASSES,
  VENUE_KINDS,
  appUrl,
  courtLabel,
  formatDate,
  formatDateTime,
  mapsUrl,
  timeAgo
} from '../../core/format';
import { CourtDetail, CourtInput, PhotoDetail, VenueDetail } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Dialog } from '../../ui/dialog';
import { Icon } from '../../ui/icon';
import { ErrorState } from '../../ui/state-panels';
import { BTN_DANGER, BTN_GHOST, BTN_LINK, BTN_PRIMARY, CARD, PILL } from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';
import { CourtFields, EMPTY_COURT, VenueDraft, VenueFields, venueDraft, venueInput } from './venue-fields';

const PHOTO_LIMIT = 10;

@Component({
  selector: 'bo-venue-detail-page',
  imports: [RouterLink, Icon, Dialog, ErrorState, VenueFields, CourtFields],
  templateUrl: './venue-detail.page.html'
})
export class VenueDetailPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly venue = signal<VenueDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly draft = signal<VenueDraft | null>(null);
  /** The court dialog: null closed, `new` for a new court, otherwise the court being edited. */
  protected readonly courtDialog = signal<'new' | CourtDetail | null>(null);
  protected readonly courtDraft = signal<CourtInput>({ ...EMPTY_COURT });
  protected readonly uploadingFor = signal<string | null>(null);

  protected readonly courts = computed(() =>
    [...(this.venue()?.courts ?? [])].sort((a, b) =>
      (a.number ?? '').localeCompare(b.number ?? '', 'pt', { numeric: true })
    )
  );
  protected readonly cover = computed(() =>
    this.courts()
      .flatMap(court => court.photos)
      .sort((a, b) => b.vote_count - a.vote_count || a.created_at.localeCompare(b.created_at))[0]
  );
  protected readonly dirty = computed(() => {
    const venue = this.venue();
    const draft = this.draft();
    return !!venue && !!draft && JSON.stringify(draft) !== JSON.stringify(venueDraft(venue));
  });
  protected readonly problem = computed(() => {
    const draft = this.draft();
    const result = draft ? venueInput(draft) : null;
    return typeof result === 'string' ? result : null;
  });

  protected readonly tones = TONE_CLASSES;
  protected readonly kinds = VENUE_KINDS;
  protected readonly access = ACCESS_OPTIONS;
  protected readonly surfaces = SURFACES;
  protected readonly photoLimit = PHOTO_LIMIT;
  protected readonly courtLabel = courtLabel;
  protected readonly mapsUrl = mapsUrl;
  protected readonly date = formatDate;
  protected readonly dateTime = formatDateTime;
  protected readonly ago = timeAgo;
  protected readonly round = Math.round;
  protected readonly styles = {
    card: CARD,
    pill: PILL,
    ghost: BTN_GHOST,
    primary: BTN_PRIMARY,
    danger: BTN_DANGER,
    link: BTN_LINK
  };

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  protected courtUrl(courtId: string): string {
    return appUrl(`/courts/${courtId}`);
  }

  protected reset(): void {
    const venue = this.venue();
    if (venue) {
      this.draft.set(venueDraft(venue));
    }
  }

  protected async save(): Promise<void> {
    const venue = this.venue();
    const draft = this.draft();
    const input = draft ? venueInput(draft) : null;
    if (!venue || !input || typeof input === 'string' || this.busy()) {
      return;
    }
    await this.run(async () => {
      await this.api.updateVenue(venue.id, input);
      this.toast.ok('Local guardado.');
    });
  }

  protected async verify(): Promise<void> {
    const venue = this.venue();
    if (!venue) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: `Verificar ${venue.name}?`,
      message: `Tem ${venue.confirmations} de 2 confirmações no local. Passa a aparecer no catálogo da app e a contar para os passaportes.`,
      details: ['Não é publicado anúncio no feed nem são enviadas notificações.', 'Não dá para voltar a rascunho.'],
      confirmLabel: 'Verificar'
    });
    if (confirmed) {
      await this.run(async () => {
        await this.api.verifyVenue(venue.id);
        void this.store.refresh();
        this.toast.ok('Local verificado.');
      });
    }
  }

  protected async removeVenue(): Promise<void> {
    const venue = this.venue();
    if (!venue) {
      return;
    }
    const captures = venue.courts.reduce((sum, court) => sum + court.capture_count, 0);
    const photos = venue.courts.reduce((sum, court) => sum + court.photos.length, 0);
    const confirmed = await this.confirm.ask({
      title: `Apagar ${venue.name}?`,
      message: `${venue.city}, ${venue.country}. Não dá para desfazer.`,
      details: [
        `${venue.courts.length} ${venue.courts.length === 1 ? 'campo' : 'campos'}, ${photos} ${photos === 1 ? 'foto' : 'fotos'} e ${captures} ${captures === 1 ? 'captura' : 'capturas'}.`,
        venue.status === 'live' ? 'O anúncio do local no feed, se tiver.' : 'Ainda é um rascunho.',
        'As partidas marcadas lá continuam, sem campo associado.'
      ],
      confirmLabel: 'Apagar local',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    try {
      const outcome = await this.api.deleteVenue(venue.id);
      this.toast.ok(`Local apagado: ${venue.name}.`);
      this.warnFiles(outcome.filesLeft);
      void this.store.refresh();
      void this.router.navigateByUrl('/venues');
    } catch (error) {
      this.toast.error(error);
      this.busy.set(false);
    }
  }

  protected openCourt(court: CourtDetail | 'new'): void {
    this.courtDraft.set(
      court === 'new' ? { ...EMPTY_COURT } : { number: court.number ?? '', surface: court.surface, indoor: court.indoor, lights: court.lights }
    );
    this.courtDialog.set(court);
  }

  protected async saveCourt(): Promise<void> {
    const venue = this.venue();
    const target = this.courtDialog();
    if (!venue || !target || this.busy()) {
      return;
    }
    const draft = this.courtDraft();
    const court = { ...draft, number: draft.number?.trim() || null };
    await this.run(async () => {
      if (target === 'new') {
        await this.api.createCourt(venue.id, court);
        this.toast.ok(`${courtLabel(court.number)} criado.`);
      } else {
        await this.api.updateCourt(target.id, court);
        this.toast.ok(`${courtLabel(court.number)} guardado.`);
      }
      this.courtDialog.set(null);
      void this.store.refresh();
    });
  }

  protected async removeCourt(court: CourtDetail): Promise<void> {
    const venue = this.venue();
    if (!venue) {
      return;
    }
    const last = venue.courts.length === 1;
    const label = courtLabel(court.number);
    const confirmed = await this.confirm.ask({
      title: `Apagar ${label}?`,
      message: last ? `É o único campo de ${venue.name}, por isso o local também é apagado.` : `Em ${venue.name}. Não dá para desfazer.`,
      details: [
        `${court.capture_count} ${court.capture_count === 1 ? 'captura sai' : 'capturas saem'} dos passaportes.`,
        `${court.photos.length} ${court.photos.length === 1 ? 'foto' : 'fotos'} e as denúncias deste campo (fica registo no histórico).`
      ],
      confirmLabel: last ? 'Apagar campo e local' : 'Apagar campo',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    try {
      const outcome = await this.api.deleteCourt(court.id);
      this.warnFiles(outcome.filesLeft);
      void this.store.refresh();
      if (outcome.venueDeleted) {
        this.toast.ok(`${label} e o local foram apagados.`);
        void this.router.navigateByUrl('/venues');
        return;
      }
      this.toast.ok(`${label} apagado.`);
      await this.load(venue.id);
    } catch (error) {
      this.toast.error(error);
    }
    this.busy.set(false);
  }

  protected async addPhoto(court: CourtDetail, field: HTMLInputElement): Promise<void> {
    const file = field.files?.[0];
    field.value = '';
    const venue = this.venue();
    if (!file || !venue) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.toast.error(new Error('Escolhe uma imagem.'));
      return;
    }
    this.uploadingFor.set(court.id);
    try {
      await this.api.addCourtPhoto(court.id, file);
      this.toast.ok('Foto adicionada.');
      await this.load(venue.id);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.uploadingFor.set(null);
    }
  }

  protected async removePhoto(photo: PhotoDetail): Promise<void> {
    const venue = this.venue();
    if (!venue) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: 'Apagar esta foto?',
      message: `${photo.vote_count} ${photo.vote_count === 1 ? 'voto' : 'votos'}. O ficheiro também sai do Storage.`,
      confirmLabel: 'Apagar foto',
      tone: 'danger'
    });
    if (confirmed) {
      await this.run(async () => {
        const outcome = await this.api.deleteCourtPhoto(photo.id);
        this.warnFiles(outcome.filesLeft);
        this.toast.ok('Foto apagada.');
      });
    }
  }

  protected async load(id: string): Promise<void> {
    this.error.set(null);
    try {
      const venue = await this.api.venue(id);
      if (id === this.id()) {
        this.venue.set(venue);
        this.draft.set(venueDraft(venue));
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }

  /** Runs a write, then re-reads the venue so every count on the page stays true. */
  private async run(action: () => Promise<void>): Promise<void> {
    const venue = this.venue();
    this.busy.set(true);
    try {
      await action();
      if (venue) {
        await this.load(venue.id);
      }
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  private warnFiles(count: number): void {
    if (count) {
      this.toast.warn(`${count} ${count === 1 ? 'ficheiro ficou' : 'ficheiros ficaram'} no Storage.`);
    }
  }
}
