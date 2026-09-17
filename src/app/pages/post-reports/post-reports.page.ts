import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import {
  POST_KINDS,
  POST_REASONS,
  POST_TYPES,
  TONE_CLASSES,
  appUrl,
  formatDateTime,
  memberNumber,
  timeAgo
} from '../../core/format';
import { PostKind, PostReport, ReportGroup, Resolution, groupReports } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Icon } from '../../ui/icon';
import { Menu } from '../../ui/menu';
import { PageHeader } from '../../ui/page-header';
import { ReportList } from '../../ui/report-list';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import {
  BTN_GHOST,
  BTN_LINK,
  CARD,
  MENU_DIVIDER,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_ITEM_OK,
  PILL,
  SEGMENT,
  SEGMENTED,
  SEGMENT_ACTIVE,
  SEGMENT_IDLE
} from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

type Tab = 'open' | 'resolved';

// An announcement post is a view of another record: deleting it takes it off the feed and nothing else.
const LINKED_RECORD: Record<Exclude<PostKind, 'authored'>, string> = {
  trip: 'Anúncio automático de uma viagem: apagar só o tira do feed, a viagem continua a existir.',
  match: 'Anúncio automático de uma partida: apagar só o tira do feed, a partida continua marcada.',
  venue: 'Anúncio automático de um local: apagar só o tira do feed, o local continua no catálogo.'
};

@Component({
  selector: 'bo-post-reports-page',
  imports: [RouterLink, Icon, Menu, PageHeader, ReportList, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './post-reports.page.html'
})
export class PostReportsPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly tab = signal<Tab>('open');
  protected readonly rows = signal<PostReport[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly reason = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);

  protected readonly reasonOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const row of this.rows() ?? []) {
      counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
    }
    return Object.entries(POST_REASONS)
      .filter(([key]) => counts.has(key))
      .map(([key, meta]) => ({ key, label: meta?.label ?? key, count: counts.get(key) ?? 0 }));
  });

  protected readonly groups = computed(() => {
    const rows = this.rows();
    if (!rows) {
      return null;
    }
    const reason = this.reason();
    const postIds = reason ? new Set(rows.filter(r => r.reason === reason).map(r => r.post_id)) : null;
    return groupReports(postIds ? rows.filter(r => postIds.has(r.post_id)) : rows, r => r.post_id);
  });

  protected readonly reasons = POST_REASONS;
  protected readonly kinds = POST_KINDS;
  protected readonly types = POST_TYPES;
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
    menuItemOk: MENU_ITEM_OK,
    menuItemDanger: MENU_ITEM_DANGER,
    menuDivider: MENU_DIVIDER
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

  protected postUrl(postId: string): string {
    return appUrl(`/posts/${postId}`);
  }

  protected linkedNote(kind: PostKind): string | null {
    return kind === 'authored' ? null : LINKED_RECORD[kind];
  }

  protected async reload(): Promise<void> {
    await this.load(this.tab());
  }

  protected async resolve(group: ReportGroup<PostReport>, resolution: Resolution): Promise<void> {
    this.busy.set(group.key);
    try {
      const count = await this.api.resolvePostReports(group.key, resolution);
      this.toast.ok(
        resolution === 'dismissed'
          ? `${count === 1 ? 'Denúncia ignorada' : `${count} denúncias ignoradas`}.`
          : `${count === 1 ? 'Denúncia marcada' : `${count} denúncias marcadas`} como tratada${count === 1 ? '' : 's'}.`
      );
      this.rows.update(rows => rows?.filter(row => row.post_id !== group.key) ?? null);
      void this.store.refresh();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async deletePost(group: ReportGroup<PostReport>): Promise<void> {
    const r = group.first;
    const linked = this.linkedNote(r.post_kind);
    const details = [
      r.post_media_url ? (r.post_media_type === 'video' ? 'O vídeo é removido do Storage.' : 'A foto é removida do Storage.') : null,
      'Os gostos e as denúncias desta publicação são apagados (fica registo no histórico).',
      linked,
      'O autor não é avisado.'
    ].filter((detail): detail is string => !!detail);
    const confirmed = await this.confirm.ask({
      title: 'Apagar esta publicação?',
      message: `De ${r.author_name ?? 'uma conta apagada'}. Não dá para desfazer.`,
      details,
      confirmLabel: 'Apagar publicação',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(group.key);
    try {
      const outcome = await this.api.deletePost(group.key);
      this.toast.ok('Publicação apagada.');
      if (outcome.filesLeft) {
        this.toast.warn('O ficheiro da publicação ficou no Storage — remove à mão se quiseres.');
      }
      this.rows.update(rows => rows?.filter(row => row.post_id !== group.key) ?? null);
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
      const rows = await this.api.postReports(tab === 'open');
      if (this.tab() === tab) {
        this.rows.set(rows);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}
