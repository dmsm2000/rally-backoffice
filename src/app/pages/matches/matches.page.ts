import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import {
  FORMATS,
  MATCH_STATUS,
  RESULT_STATUS,
  SESSION_TYPES,
  TONE_CLASSES,
  appUrl,
  courtLabel,
  formatDay,
  formatSets,
  formatTime,
  playerName
} from '../../core/format';
import { MatchRow, MatchStatus } from '../../core/models';
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

const LIMIT = 50;
const MAX_SETS = 6;

const FILTERS: { status: MatchStatus | null; param: string | null; label: string }[] = [
  { status: null, param: null, label: 'Todas' },
  { status: 'upcoming', param: 'upcoming', label: 'Agendadas' },
  { status: 'open', param: 'open', label: 'Em aberto' },
  { status: 'pending', param: 'pending', label: 'Convites pendentes' },
  { status: 'complete', param: 'complete', label: 'Terminadas' },
  { status: 'cancelled', param: 'cancelled', label: 'Canceladas' }
];

interface EditDraft {
  match: MatchRow;
  date: string;
  time: string;
  timeEnd: string;
  duration: string;
  country: string;
  city: string;
  note: string;
}

interface ResultDraft {
  match: MatchRow;
  winner: 'a' | 'b' | '';
  sets: [string, string][];
}

@Component({
  selector: 'bo-matches-page',
  imports: [RouterLink, Icon, Dialog, Menu, PageHeader, SearchBox, Pager, PlaceFields, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './matches.page.html'
})
export class MatchesPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly filterParam = input<string>(undefined, { alias: 'filter' });
  readonly playerParam = input<string>(undefined, { alias: 'player' });

  protected readonly filters = FILTERS;
  protected readonly status = computed(() => FILTERS.find(f => f.param === this.filterParam())?.status ?? null);
  protected readonly search = signal('');
  protected readonly offset = signal(0);
  protected readonly rows = signal<MatchRow[] | null>(null);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly edit = signal<EditDraft | null>(null);
  protected readonly result = signal<ResultDraft | null>(null);

  protected readonly resultProblem = computed(() => {
    const draft = this.result();
    if (!draft) {
      return null;
    }
    const filled = draft.sets.filter(([a, b]) => a !== '' || b !== '');
    if (filled.some(([a, b]) => a === '' || b === '')) {
      return 'Preenche os dois lados de cada set, ou deixa-o em branco.';
    }
    return null;
  });

  protected readonly limit = LIMIT;
  protected readonly maxSets = MAX_SETS;
  protected readonly statuses = MATCH_STATUS;
  protected readonly results = RESULT_STATUS;
  protected readonly formats = FORMATS;
  protected readonly sessions = SESSION_TYPES;
  protected readonly tones = TONE_CLASSES;
  protected readonly day = formatDay;
  protected readonly time = formatTime;
  protected readonly sets = formatSets;
  protected readonly name = playerName;
  protected readonly courtLabel = courtLabel;
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
      const request = { search: this.search(), status: this.status(), player: this.playerParam() ?? null, offset: this.offset() };
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

  protected matchUrl(id: string): string {
    return appUrl(`/matches/${id}`);
  }

  protected canCancel(match: MatchRow): boolean {
    return match.status === 'pending' || match.status === 'open' || match.status === 'upcoming';
  }

  protected winnerName(match: MatchRow): string | null {
    if (!match.winner) {
      return null;
    }
    return match.winner === match.player_a ? playerName(match.player_a_name) : playerName(match.player_b_name);
  }

  protected async reload(): Promise<void> {
    await this.load({ search: this.search(), status: this.status(), player: this.playerParam() ?? null, offset: this.offset() });
  }

  protected openEdit(match: MatchRow): void {
    this.edit.set({
      match,
      date: match.match_date,
      time: formatTime(match.match_time),
      timeEnd: formatTime(match.match_time_end),
      duration: match.duration_minutes?.toString() ?? '',
      country: match.country,
      city: match.city,
      note: match.note ?? ''
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
    await this.write(draft.match.id, 'Partida guardada.', async () => {
      await this.api.updateMatch(draft.match.id, {
        matchDate: draft.date,
        matchTime: draft.time,
        matchTimeEnd: draft.timeEnd || null,
        durationMinutes: draft.duration ? Number(draft.duration) : null,
        city: draft.city,
        country: draft.country,
        note: draft.note.trim() || null
      });
      this.edit.set(null);
    });
  }

  protected openResult(match: MatchRow): void {
    const sets: [string, string][] = (match.sets ?? []).map(([a, b]) => [String(a), String(b)]);
    while (sets.length < 3) {
      sets.push(['', '']);
    }
    this.result.set({
      match,
      winner: match.winner === match.player_a ? 'a' : match.winner && match.winner === match.player_b ? 'b' : '',
      sets
    });
  }

  protected setCell(index: number, side: 0 | 1, text: string): void {
    const value = text.replace(/\D/g, '').slice(0, 2);
    this.result.update(draft => {
      if (!draft) {
        return draft;
      }
      const sets = draft.sets.map(pair => [...pair] as [string, string]);
      sets[index][side] = value;
      return { ...draft, sets };
    });
  }

  protected addSet(): void {
    this.result.update(draft => (draft && draft.sets.length < MAX_SETS ? { ...draft, sets: [...draft.sets, ['', '']] } : draft));
  }

  protected removeSet(): void {
    this.result.update(draft => (draft && draft.sets.length > 1 ? { ...draft, sets: draft.sets.slice(0, -1) } : draft));
  }

  protected setWinner(winner: 'a' | 'b' | ''): void {
    this.result.update(draft => (draft ? { ...draft, winner } : draft));
  }

  protected async saveResult(): Promise<void> {
    const draft = this.result();
    if (!draft || this.resultProblem() || this.busy()) {
      return;
    }
    const sets = draft.sets.filter(([a, b]) => a !== '' && b !== '').map(([a, b]) => [Number(a), Number(b)] as [number, number]);
    const winner = draft.winner === 'a' ? draft.match.player_a : draft.winner === 'b' ? draft.match.player_b : null;
    await this.write(draft.match.id, 'Resultado guardado.', async () => {
      await this.api.setMatchResult(draft.match.id, winner, sets.length ? sets : null);
      this.result.set(null);
    });
  }

  protected async cancel(match: MatchRow): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Cancelar esta partida?',
      message: `${this.players(match)} · ${formatDay(match.match_date)} ${formatTime(match.match_time)}, ${match.city}.`,
      details: ['Os jogadores não são notificados.', 'O anúncio no feed, se existir, passa a mostrar a partida cancelada.'],
      confirmLabel: 'Cancelar partida',
      tone: 'danger'
    });
    if (confirmed) {
      await this.write(match.id, 'Partida cancelada.', () => this.api.cancelMatch(match.id));
    }
  }

  protected async remove(match: MatchRow): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Apagar esta partida?',
      message: `${this.players(match)} · ${formatDay(match.match_date)}, ${match.city}. Não dá para desfazer.`,
      details: [
        'Desaparece do histórico e dos passaportes de todos os jogadores.',
        'O anúncio no feed, se existir, também é apagado.',
        'As capturas de campo que a partida deu ficam.'
      ],
      confirmLabel: 'Apagar partida',
      tone: 'danger'
    });
    if (confirmed) {
      await this.write(match.id, 'Partida apagada.', () => this.api.deleteMatch(match.id));
    }
  }

  protected players(match: MatchRow): string {
    if (match.format === 'Doubles') {
      return match.participant_names.length ? match.participant_names.join(', ') : playerName(match.player_a_name);
    }
    return match.player_b || this.bLeft(match)
      ? `${playerName(match.player_a_name)} vs ${playerName(match.player_b_name)}`
      : `${playerName(match.player_a_name)} (à procura de adversário)`;
  }

  /** An empty player_b on a direct invite or a played match is someone who deleted their account, not an open spot. */
  protected bLeft(match: MatchRow): boolean {
    return !match.player_b && (match.kind === 'direct' || match.status === 'complete');
  }

  private async write(id: string, message: string, action: () => Promise<void>): Promise<void> {
    this.busy.set(id);
    try {
      await action();
      this.toast.ok(message);
      void this.store.refresh();
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  private async load(request: { search: string; status: MatchStatus | null; player: string | null; offset: number }): Promise<void> {
    const id = ++this.requestId;
    this.rows.set(null);
    this.error.set(null);
    try {
      const result = await this.api.matches({ search: request.search, status: request.status, player: request.player }, LIMIT, request.offset);
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
