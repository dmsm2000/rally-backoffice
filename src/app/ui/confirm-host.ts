import { Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'bo-confirm-host',
  host: { '(document:keydown.escape)': 'confirm.pending() && confirm.answer(false)' },
  template: `
    @if (confirm.pending(); as request) {
      <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" (click)="confirm.answer(false)">
        <div
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="request.title"
          class="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg font-bold">{{ request.title }}</h2>
          <p class="mt-2 text-sm text-muted">{{ request.message }}</p>
          @if (request.details?.length) {
            <ul class="mt-4 space-y-1.5 rounded-xl border border-line bg-bg/60 p-3 text-sm">
              @for (detail of request.details; track $index) {
                <li class="flex gap-2"><span class="text-faint">•</span><span>{{ detail }}</span></li>
              }
            </ul>
          }
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" (click)="confirm.answer(false)" class="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-raised">
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirm.answer(true)"
              class="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold"
              [class]="request.tone === 'danger' ? 'bg-danger text-white hover:bg-danger/85' : 'bg-lime text-bg hover:bg-lime/85'"
            >
              {{ request.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmHost {
  protected readonly confirm = inject(ConfirmService);
}
