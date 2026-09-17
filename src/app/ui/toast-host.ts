import { Component, inject } from '@angular/core';
import { Icon } from './icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'bo-toast-host',
  imports: [Icon],
  template: `
    <div class="pointer-events-none fixed right-4 bottom-4 left-4 z-60 flex flex-col items-end gap-2 sm:left-auto">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          role="status"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-2xl"
          [class]="toast.tone === 'ok' ? 'border-ok/40' : toast.tone === 'warn' ? 'border-warn/40' : 'border-danger/50'"
        >
          <span [class]="toast.tone === 'ok' ? 'text-ok' : toast.tone === 'warn' ? 'text-warn' : 'text-danger'">
            <bo-icon [name]="toast.tone === 'ok' ? 'check' : 'error-circle'" />
          </span>
          <p class="flex-1">{{ toast.message }}</p>
          <button type="button" (click)="toasts.dismiss(toast.id)" aria-label="Fechar" class="cursor-pointer text-faint hover:text-fg">
            <bo-icon name="close" />
          </button>
        </div>
      }
    </div>
  `
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
}
