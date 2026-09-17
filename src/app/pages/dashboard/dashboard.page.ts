import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import { BAR_CLASSES, COURT_REASONS, POST_REASONS, TONE_CLASSES, Tone, formatNumber, timeAgo } from '../../core/format';
import { describeLog } from '../../core/log-format';
import { LogEntry } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { Icon, IconName } from '../../ui/icon';
import { PageHeader } from '../../ui/page-header';
import { ErrorState } from '../../ui/state-panels';
import { BTN_GHOST, BTN_LINK, CARD } from '../../ui/styles';

interface QueueCard {
  label: string;
  value: number;
  detail: string;
  link: string;
  queryParams?: Record<string, string>;
  icon: IconName;
  tone: Tone;
}

interface ReasonBar {
  label: string;
  count: number;
  percent: number;
  bar: string;
}

function reasonBars(counts: Record<string, number>, labels: Partial<Record<string, { label: string; tone: Tone }>>): ReasonBar[] {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return Object.entries(counts)
    .map(([reason, count]) => ({
      label: labels[reason]?.label ?? reason,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
      bar: BAR_CLASSES[labels[reason]?.tone ?? 'neutral']
    }))
    .sort((a, b) => b.count - a.count);
}

@Component({
  selector: 'bo-dashboard-page',
  imports: [RouterLink, Icon, PageHeader, ErrorState],
  templateUrl: './dashboard.page.html'
})
export class DashboardPage {
  protected readonly store = inject(ModerationStore);
  private readonly api = inject(AdminApi);

  protected readonly log = signal<LogEntry[] | null>(null);
  protected readonly refreshing = signal(false);

  protected readonly btnGhost = BTN_GHOST;
  protected readonly btnLink = BTN_LINK;
  protected readonly card = CARD;
  protected readonly toneClasses = TONE_CLASSES;
  protected readonly timeAgo = timeAgo;
  protected readonly n = formatNumber;
  protected readonly describe = describeLog;

  protected readonly queue = computed<QueueCard[] | null>(() => {
    const d = this.store.dashboard();
    if (!d) {
      return null;
    }
    return [
      {
        label: 'Denúncias de campos',
        value: d.open_court_reports,
        detail: d.open_court_reports ? `em ${d.reported_courts} ${d.reported_courts === 1 ? 'campo' : 'campos'}` : 'Tudo em dia',
        link: '/reports/courts',
        icon: 'courts',
        tone: d.open_court_reports ? 'danger' : 'ok'
      },
      {
        label: 'Denúncias de publicações',
        value: d.open_post_reports,
        detail: d.open_post_reports ? `em ${d.reported_posts} ${d.reported_posts === 1 ? 'publicação' : 'publicações'}` : 'Tudo em dia',
        link: '/reports/posts',
        icon: 'image',
        tone: d.open_post_reports ? 'danger' : 'ok'
      },
      {
        label: 'Rascunhos antigos',
        value: d.venues_stale_draft,
        detail: d.venues_stale_draft ? 'por confirmar há mais de 60 dias' : 'Nenhum abandonado',
        link: '/venues',
        queryParams: { filter: 'stale' },
        icon: 'map-pin',
        tone: d.venues_stale_draft ? 'warn' : 'ok'
      }
    ];
  });

  protected readonly reasonPanels = computed(() => {
    const d = this.store.dashboard();
    return [
      { title: 'Motivos — campos', link: '/reports/courts', bars: reasonBars(d?.court_report_reasons ?? {}, COURT_REASONS) },
      { title: 'Motivos — publicações', link: '/reports/posts', bars: reasonBars(d?.post_report_reasons ?? {}, POST_REASONS) }
    ];
  });

  protected readonly community = computed(() => {
    const d = this.store.dashboard();
    if (!d) {
      return null;
    }
    const blocked = d.players_blocked ?? 0;
    return [
      {
        label: 'Jogadores',
        value: d.players,
        detail: `+${d.players_last_7d} esta semana${blocked ? ` · ${blocked} ${blocked === 1 ? 'bloqueado' : 'bloqueados'}` : ''}`,
        accent: 'text-lime',
        link: '/players'
      },
      { label: 'Publicações', value: d.posts, detail: `+${d.posts_last_7d} esta semana`, accent: 'text-cobalt', link: '/posts' },
      {
        label: 'Partidas jogadas',
        value: d.matches_complete,
        detail: `${d.matches_upcoming} agendadas · ${d.matches_open} em aberto`,
        accent: 'text-lime',
        link: '/matches'
      },
      { label: 'Viagens marcadas', value: d.trips_upcoming ?? 0, detail: 'ainda por acontecer', accent: 'text-cobalt', link: '/trips' },
      { label: 'Locais verificados', value: d.venues_live, detail: `${d.venues_draft} por confirmar`, accent: 'text-clay', link: '/venues' },
      { label: 'Campos', value: d.courts, detail: 'em todos os locais', accent: 'text-clay', link: '/venues' },
      {
        label: 'Lista de espera',
        value: d.waitlist ?? 0,
        detail: `+${d.waitlist_last_7d ?? 0} esta semana`,
        accent: 'text-fg',
        link: '/waitlist'
      },
      { label: 'As tuas ações', value: d.actions_last_7d, detail: 'nos últimos 7 dias', accent: 'text-fg', link: '/activity' }
    ];
  });

  constructor() {
    void this.loadLog();
  }

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    await Promise.all([this.store.refresh(), this.loadLog()]);
    this.refreshing.set(false);
  }

  private async loadLog(): Promise<void> {
    try {
      this.log.set(await this.api.log(6));
    } catch {
      this.log.set([]);
    }
  }
}
