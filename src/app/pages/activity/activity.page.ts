import { JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/admin-api';
import { TONE_CLASSES, formatDateTime } from '../../core/format';
import { LOG_ACTIONS, LogCategory, LogLine, describeLog } from '../../core/log-format';
import { LogEntry } from '../../core/models';
import { Icon } from '../../ui/icon';
import { PageHeader } from '../../ui/page-header';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import { BTN_GHOST, CARD, PILL } from '../../ui/styles';

type ActionFilter = 'all' | LogCategory;

interface Day {
  label: string;
  entries: { entry: LogEntry; line: LogLine; time: string }[];
}

const dayFormat = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) {
    return 'Hoje';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  }
  const label = dayFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

@Component({
  selector: 'bo-activity-page',
  imports: [JsonPipe, Icon, PageHeader, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './activity.page.html'
})
export class ActivityPage {
  private readonly api = inject(AdminApi);

  protected readonly rows = signal<LogEntry[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<ActionFilter>('all');

  protected readonly filters: { key: ActionFilter; label: string }[] = [
    { key: 'all', label: 'Tudo' },
    { key: 'moderation', label: 'Moderação' },
    { key: 'create', label: 'Criado' },
    { key: 'update', label: 'Editado' },
    { key: 'delete', label: 'Apagado' }
  ];

  protected readonly days = computed<Day[] | null>(() => {
    const rows = this.rows();
    if (!rows) {
      return null;
    }
    const filter = this.filter();
    const days: Day[] = [];
    for (const entry of rows) {
      if (filter !== 'all' && LOG_ACTIONS[entry.action]?.category !== filter) {
        continue;
      }
      const label = dayLabel(entry.created_at);
      let day = days.at(-1);
      if (day?.label !== label) {
        day = { label, entries: [] };
        days.push(day);
      }
      day.entries.push({ entry, line: describeLog(entry), time: timeFormat.format(new Date(entry.created_at)) });
    }
    return days;
  });

  protected readonly tones = TONE_CLASSES;
  protected readonly dateTime = formatDateTime;
  protected readonly styles = { card: CARD, pill: PILL, ghost: BTN_GHOST };

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.error.set(null);
    try {
      this.rows.set(await this.api.log(500));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}
