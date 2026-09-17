import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import { TONE_CLASSES, formatDateTime, formatDay, memberNumber, playerName, timeAgo } from '../../core/format';
import { TripRow } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Dialog } from '../../ui/dialog';
import { Icon } from '../../ui/icon';
import { Pager, SearchBox } from '../../ui/list-controls';
import { Menu } from '../../ui/menu';
import { PageHeader } from '../../ui/page-header';
import { PlaceFields } from '../../ui/place-fields';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import {
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  CARD,
  CHIP,
  CHIP_ACTIVE,
  CHIP_IDLE,
  INPUT,
  LABEL,
  MENU_DIVIDER,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  PILL
} from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

type When = 'upcoming' | 'past' | 'all';
const LIMIT = 50;

const FILTERS: { key: When; param: string | null; label: string }[] = [
  { key: 'upcoming', param: null, label: 'Próximas' },
  { key: 'past', param: 'past', label: 'Passadas' },
  { key: 'all', param: 'all', label: 'Todas' }
];

interface EditDraft {
  trip: TripRow;
  country: string;
  city: string;
  fromDate: string;
  toDate: string;
  note: string;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'bo-trips-page',
  imports: [RouterLink, Icon, Dialog, Menu, PageHeader, SearchBox, Pager, PlaceFields, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './trips.page.html'
})
export class TripsPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly filterParam = input<string>(undefined, { alias: 'filter' });
  readonly playerParam = input<string>(undefined, { alias: 'player' });

  protected readonly filters = FILTERS;
  protected readonly when = computed<When>(() => FILTERS.find(f => f.param === (this.filterParam() ?? null))?.key ?? 'upcoming');
  protected readonly search = signal('');
  protected readonly offset = signal(0);
  protected readonly rows = signal<TripRow[] | null>(null);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly edit = signal<EditDraft | null>(null);

  protected readonly limit = LIMIT;
  protected readonly tones = TONE_CLASSES;
  protected readonly day = formatDay;
  protected readonly ago = timeAgo;
  protected readonly dateTime = formatDateTime;
  protected readonly member = memberNumber;
  protected readonly name = playerName;
  protected readonly styles = {
    card: CARD,
    pill: PILL,
    ghost: BTN_GHOST,
    primary: BTN_PRIMARY,
    danger: BTN_DANGER,
    input: INPUT,
    label: LABEL,
    chip: CHIP,
    chipActive: CHIP_ACTIVE,
    chipIdle: CHIP_IDLE,
    menuItem: MENU_ITEM,
    menuItemDanger: MENU_ITEM_DANGER,
    menuDivider: MENU_DIVIDER
  };

  private requestId = 0;

  constructor() {
    effect(() => {
      const request = { search: this.search(), when: this.when(), player: this.playerParam() ?? null, offset: this.offset() };
      untracked(() => void this.load(request));
    });
  }

  protected setFilter(param: string | null): void {
    this.offset.set(0);
    void this.router.navigate([], { queryParams: { filter: param }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected clearPlayer(): void {
    this.offset.set(0);
    void this.router.navigate([], { queryParams: { player: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected setSearch(value: string): void {
    this.offset.set(0);
    this.search.set(value);
  }

  protected isOngoing(trip: TripRow): boolean {
    const now = today();
    return trip.from_date <= now && trip.to_date >= now;
  }

  protected isPast(trip: TripRow): boolean {
    return trip.to_date < today();
  }

  protected async reload(): Promise<void> {
    await this.load({ search: this.search(), when: this.when(), player: this.playerParam() ?? null, offset: this.offset() });
  }

  protected openEdit(trip: TripRow): void {
    this.edit.set({
      trip,
      country: trip.destination_country,
      city: trip.destination_city,
      fromDate: trip.from_date,
      toDate: trip.to_date,
      note: trip.note
    });
  }

  protected patchEdit(change: Partial<EditDraft>): void {
    this.edit.update(draft => (draft ? { ...draft, ...change } : draft));
  }

  protected async saveEdit(): Promise<void> {
    const draft = this.edit();
    if (!draft || this.busy()) {
      return;
    }
    this.busy.set(draft.trip.id);
    try {
      await this.api.updateTrip(draft.trip.id, {
        country: draft.country,
        city: draft.city,
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        note: draft.note.trim()
      });
      this.edit.set(null);
      this.toast.ok('Viagem guardada.');
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async remove(trip: TripRow): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Apagar esta viagem?',
      message: `${playerName(trip.player_name)} para ${trip.destination_city}, ${trip.destination_country}. Não dá para desfazer.`,
      details: [
        `${trip.hosts} ${trip.hosts === 1 ? 'pessoa ofereceu-se' : 'pessoas ofereceram-se'} para receber — esses registos também saem.`,
        'O anúncio da viagem no feed é apagado.',
        'Ninguém é notificado.'
      ],
      confirmLabel: 'Apagar viagem',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(trip.id);
    try {
      await this.api.deleteTrip(trip.id);
      this.toast.ok('Viagem apagada.');
      void this.store.refresh();
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  private async load(request: { search: string; when: When; player: string | null; offset: number }): Promise<void> {
    const id = ++this.requestId;
    this.rows.set(null);
    this.error.set(null);
    try {
      const result = await this.api.trips({ search: request.search, when: request.when, player: request.player }, LIMIT, request.offset);
      if (id === this.requestId) {
        this.rows.set(result.rows);
        this.total.set(result.total);
      }
    } catch (error) {
      if (id === this.requestId) {
        this.error.set(error instanceof Error ? error.message : String(error));
      }
    }
  }
}
