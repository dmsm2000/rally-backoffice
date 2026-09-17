import { Component, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../core/admin-api';
import { BUG_REPORT_PAGES, BUG_REPORT_STATUS, TONE_CLASSES, formatDateTime, memberNumber, timeAgo } from '../../core/format';
import { BugReportRow, BugReportStatus } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { Icon } from '../../ui/icon';
import { Pager } from '../../ui/list-controls';
import { Menu } from '../../ui/menu';
import { PageHeader } from '../../ui/page-header';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import {
  BTN_GHOST,
  CARD,
  MENU_DIVIDER,
  MENU_ITEM,
  MENU_ITEM_OK,
  PILL,
  SEGMENT,
  SEGMENTED,
  SEGMENT_ACTIVE,
  SEGMENT_IDLE
} from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

const LIMIT = 20;

/** Reported from the profile page's "Reportar um bug" section (rally/CLAUDE.md, Bug Reporting). */
@Component({
  selector: 'bo-bug-reports-page',
  imports: [Icon, Menu, PageHeader, Pager, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './bug-reports.page.html'
})
export class BugReportsPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<BugReportStatus>('pending');
  protected readonly offset = signal(0);
  protected readonly rows = signal<BugReportRow[] | null>(null);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  /** The report currently being acted on — its own menu disables, the rest stays usable. */
  protected readonly busy = signal<string | null>(null);

  protected readonly limit = LIMIT;
  protected readonly pages = BUG_REPORT_PAGES;
  protected readonly statuses = BUG_REPORT_STATUS;
  protected readonly tones = TONE_CLASSES;
  protected readonly ago = timeAgo;
  protected readonly dateTime = formatDateTime;
  protected readonly memberNumber = memberNumber;
  protected readonly styles = {
    card: CARD,
    ghost: BTN_GHOST,
    pill: PILL,
    segmented: SEGMENTED,
    segment: SEGMENT,
    segmentActive: SEGMENT_ACTIVE,
    segmentIdle: SEGMENT_IDLE,
    menuItem: MENU_ITEM,
    menuItemOk: MENU_ITEM_OK,
    menuDivider: MENU_DIVIDER
  };

  private requestId = 0;

  constructor() {
    effect(() => {
      const request = { tab: this.tab(), offset: this.offset() };
      untracked(() => void this.load(request.tab, request.offset));
    });
  }

  protected setTab(tab: BugReportStatus): void {
    this.offset.set(0);
    this.tab.set(tab);
  }

  protected async reload(): Promise<void> {
    await this.load(this.tab(), this.offset());
  }

  protected async setStatus(row: BugReportRow, status: BugReportStatus): Promise<void> {
    this.busy.set(row.id);
    try {
      await this.api.updateBugReportStatus(row.id, status);
      this.toast.ok(`Marcado como "${this.statuses[status].label}".`);
      // The row no longer belongs to the tab it was just moved out of.
      this.rows.update(rows => rows?.filter(r => r.id !== row.id) ?? null);
      this.total.update(n => Math.max(0, n - 1));
      void this.store.refresh();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  private async load(tab: BugReportStatus, offset: number): Promise<void> {
    const id = ++this.requestId;
    this.rows.set(null);
    this.error.set(null);
    try {
      const result = await this.api.bugReports(tab, LIMIT, offset);
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
