import { Component, input } from '@angular/core';
import { TONE_CLASSES, Tone, formatDateTime, memberNumber, timeAgo } from '../core/format';
import { Resolution } from '../core/models';
import { PILL } from './styles';

interface ReportLike {
  id: string;
  reason: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: Resolution | null;
  reporter_name: string | null;
  reporter_member_number: number | null;
}

/** The individual reports inside a court or post card: who, why, when. */
@Component({
  selector: 'bo-report-list',
  host: { class: 'block' },
  template: `
    <ul class="divide-y divide-line rounded-xl border border-line bg-bg/40">
      @for (report of reports(); track report.id) {
        <li class="flex flex-col gap-1.5 px-3.5 py-3 sm:flex-row sm:items-start sm:gap-3">
          <span class="self-start" [class]="reasonClass(report.reason)">{{ reasonLabel(report.reason) }}</span>
          <div class="min-w-0 flex-1">
            @if (report.note) {
              <p class="text-sm whitespace-pre-line">“{{ report.note }}”</p>
            }
            <p class="text-xs text-muted" [class.mt-1]="!!report.note">
              {{ report.reporter_name ?? 'Conta apagada' }}
              @if (report.reporter_member_number != null) {
                <span class="font-mono text-faint">{{ member(report.reporter_member_number) }}</span>
              }
              · <span [title]="dateTime(report.created_at)">{{ ago(report.created_at) }}</span>
            </p>
          </div>
        </li>
      }
    </ul>
  `
})
export class ReportList {
  readonly reports = input.required<ReportLike[]>();
  readonly reasons = input.required<Partial<Record<string, { label: string; tone: Tone }>>>();

  protected readonly ago = timeAgo;
  protected readonly dateTime = formatDateTime;
  protected readonly member = memberNumber;

  protected reasonLabel(reason: string): string {
    return this.reasons()[reason]?.label ?? reason;
  }

  protected reasonClass(reason: string): string {
    return `${PILL} ${TONE_CLASSES[this.reasons()[reason]?.tone ?? 'neutral']}`;
  }
}
