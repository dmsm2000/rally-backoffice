import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import { PLAYER_REASONS, TONE_CLASSES, formatDateTime, memberNumber, timeAgo } from '../../core/format';
import { PlayerReport, ReportGroup, Resolution, groupReports } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { Icon } from '../../ui/icon';
import { Menu } from '../../ui/menu';
import { PageHeader } from '../../ui/page-header';
import { ReportList } from '../../ui/report-list';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import {
  BTN_GHOST,
  BTN_LINK,
  CARD,
  MENU_ITEM,
  MENU_ITEM_OK,
  PILL,
  SEGMENT,
  SEGMENTED,
  SEGMENT_ACTIVE,
  SEGMENT_IDLE
} from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

type Tab = 'open' | 'resolved';

/**
 * Reports about a player (0052), grouped by the player they are about. What to do about the player — suspend or
 * delete them — is on their own page, one click away; this page is where the reports are read and closed.
 */
@Component({
  selector: 'bo-player-reports-page',
  imports: [RouterLink, Icon, Menu, PageHeader, ReportList, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './player-reports.page.html'
})
export class PlayerReportsPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<Tab>('open');
  protected readonly rows = signal<PlayerReport[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly reason = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);

  protected readonly reasonOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const row of this.rows() ?? []) {
      counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
    }
    return Object.entries(PLAYER_REASONS)
      .filter(([key]) => counts.has(key))
      .map(([key, meta]) => ({ key, label: meta?.label ?? key, count: counts.get(key) ?? 0 }));
  });

  protected readonly groups = computed(() => {
    const rows = this.rows();
    if (!rows) {
      return null;
    }
    const reason = this.reason();
    const playerIds = reason ? new Set(rows.filter(r => r.reason === reason).map(r => r.reported_id)) : null;
    return groupReports(playerIds ? rows.filter(r => playerIds.has(r.reported_id)) : rows, r => r.reported_id);
  });

  protected readonly reasons = PLAYER_REASONS;
  protected readonly tones = TONE_CLASSES;
  protected readonly ago = timeAgo;
  protected readonly dateTime = formatDateTime;
  protected readonly member = memberNumber;
  protected readonly styles = {
    card: CARD,
    pill: PILL,
    ghost: BTN_GHOST,
    link: BTN_LINK,
    segmented: SEGMENTED,
    segment: SEGMENT,
    segmentActive: SEGMENT_ACTIVE,
    segmentIdle: SEGMENT_IDLE,
    menuItem: MENU_ITEM,
    menuItemOk: MENU_ITEM_OK
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

  protected async reload(): Promise<void> {
    await this.load(this.tab());
  }

  protected async resolve(group: ReportGroup<PlayerReport>, resolution: Resolution): Promise<void> {
    this.busy.set(group.key);
    try {
      const count = await this.api.resolvePlayerReports(group.key, resolution);
      this.toast.ok(
        resolution === 'dismissed'
          ? `${count === 1 ? 'Denúncia ignorada' : `${count} denúncias ignoradas`}.`
          : `${count === 1 ? 'Denúncia marcada' : `${count} denúncias marcadas`} como tratada${count === 1 ? '' : 's'}.`
      );
      this.rows.update(rows => rows?.filter(row => row.reported_id !== group.key) ?? null);
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
      const rows = await this.api.playerReports(tab === 'open');
      if (this.tab() === tab) {
        this.rows.set(rows);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}
