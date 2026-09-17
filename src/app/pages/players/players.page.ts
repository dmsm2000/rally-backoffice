import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import { TONE_CLASSES, formatDate, formatDateTime, initials, memberNumber, timeAgo } from '../../core/format';
import { PlayerRow } from '../../core/models';
import { Icon } from '../../ui/icon';
import { Pager, SearchBox } from '../../ui/list-controls';
import { PageHeader } from '../../ui/page-header';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import { BTN_GHOST, CARD, CHIP, CHIP_ACTIVE, CHIP_IDLE, PILL } from '../../ui/styles';

type Filter = 'all' | 'recent' | 'blocked';
const LIMIT = 50;

const FILTERS: { key: Filter; param: string | null; label: string }[] = [
  { key: 'all', param: null, label: 'Todos' },
  { key: 'recent', param: 'new', label: 'Novos (7 dias)' },
  { key: 'blocked', param: 'blocked', label: 'Bloqueados' }
];

@Component({
  selector: 'bo-players-page',
  imports: [RouterLink, Icon, PageHeader, SearchBox, Pager, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './players.page.html'
})
export class PlayersPage {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);

  /** `?filter=` — `new` or `blocked`. */
  readonly filterParam = input<string>(undefined, { alias: 'filter' });
  readonly searchParam = input<string>(undefined, { alias: 'search' });

  protected readonly filters = FILTERS;
  protected readonly filter = computed<Filter>(() => FILTERS.find(f => f.param === this.filterParam())?.key ?? 'all');
  protected readonly search = signal('');
  protected readonly offset = signal(0);
  protected readonly rows = signal<PlayerRow[] | null>(null);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);

  protected readonly limit = LIMIT;
  protected readonly tones = TONE_CLASSES;
  protected readonly styles = { card: CARD, pill: PILL, ghost: BTN_GHOST, chip: CHIP, chipActive: CHIP_ACTIVE, chipIdle: CHIP_IDLE };
  protected readonly member = memberNumber;
  protected readonly initials = initials;
  protected readonly date = formatDate;
  protected readonly dateTime = formatDateTime;
  protected readonly ago = timeAgo;

  private requestId = 0;

  constructor() {
    effect(() => this.search.set(this.searchParam() ?? ''));
    effect(() => {
      const request = { search: this.search(), filter: this.filter(), offset: this.offset() };
      untracked(() => void this.load(request));
    });
  }

  protected setFilter(param: string | null): void {
    this.offset.set(0);
    void this.router.navigate([], { queryParams: { filter: param }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected setSearch(value: string): void {
    this.offset.set(0);
    this.search.set(value);
  }

  protected async reload(): Promise<void> {
    await this.load({ search: this.search(), filter: this.filter(), offset: this.offset() });
  }

  private async load(request: { search: string; filter: Filter; offset: number }): Promise<void> {
    const id = ++this.requestId;
    this.rows.set(null);
    this.error.set(null);
    try {
      const result = await this.api.players(request.search, request.filter, LIMIT, request.offset);
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
