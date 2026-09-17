import { Component, inject, input, output } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { Icon } from './icon';

/**
 * Form dialog shell: bottom sheet on a phone, centred card from `sm`. Callers keep their own `@if`;
 * body is the default slot, buttons go in `[dialog-actions]`.
 */
@Component({
  selector: 'bo-dialog',
  imports: [Icon],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" (click)="closed.emit()">
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        class="flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl"
        [class]="wide() ? 'sm:max-w-2xl' : 'sm:max-w-lg'"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div class="min-w-0">
            @if (eyebrow()) {
              <p class="eyebrow text-lime">{{ eyebrow() }}</p>
            }
            <h2 class="mt-1 text-lg font-bold">{{ title() }}</h2>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            aria-label="Fechar"
            class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-muted hover:bg-raised hover:text-fg"
          >
            <bo-icon name="close" />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <ng-content />
        </div>
        <footer class="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">
          <ng-content select="[dialog-actions]" />
        </footer>
      </div>
    </div>
  `
})
export class Dialog {
  private readonly confirm = inject(ConfirmService);

  readonly title = input.required<string>();
  readonly eyebrow = input<string>();
  readonly wide = input(false);
  readonly closed = output<void>();

  protected onEscape(): void {
    // A confirmation opened from inside the dialog takes Escape first.
    if (!this.confirm.pending()) {
      this.closed.emit();
    }
  }
}
