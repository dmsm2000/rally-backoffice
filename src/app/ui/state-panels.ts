import { Component, input, output } from '@angular/core';
import { Icon, IconName } from './icon';
import { BTN_GHOST } from './styles';

@Component({
  selector: 'bo-empty',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <span class="flex size-12 items-center justify-center rounded-full bg-ok/12 text-ok">
        <bo-icon [name]="icon()" size="size-5" />
      </span>
      <p class="mt-4 font-bold">{{ title() }}</p>
      @if (body()) {
        <p class="mt-1 max-w-sm text-sm text-muted">{{ body() }}</p>
      }
    </div>
  `
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly body = input<string>();
  readonly icon = input<IconName>('check');
}

@Component({
  selector: 'bo-error',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-4 rounded-2xl border border-danger/35 bg-danger/8 p-5 sm:flex-row sm:items-center">
      <span class="text-danger"><bo-icon name="error-circle" size="size-6" /></span>
      <div class="flex-1">
        <p class="font-bold">Não foi possível carregar</p>
        <p class="mt-0.5 text-sm text-muted">{{ message() }}</p>
      </div>
      <button type="button" (click)="retry.emit()" [class]="btnGhost">
        <bo-icon name="refresh" />
        Tentar outra vez
      </button>
    </div>
  `
})
export class ErrorState {
  readonly message = input.required<string>();
  readonly retry = output<void>();
  protected readonly btnGhost = BTN_GHOST;
}

@Component({
  selector: 'bo-skeleton-cards',
  host: { class: 'block' },
  template: `
    <div class="space-y-4" aria-busy="true" aria-label="A carregar">
      @for (i of rows(); track i) {
        <div class="flex animate-pulse gap-5 rounded-2xl border border-line bg-surface p-5">
          <div class="hidden h-28 w-40 rounded-xl bg-raised md:block"></div>
          <div class="flex-1 space-y-3">
            <div class="h-4 w-24 rounded bg-raised"></div>
            <div class="h-6 w-2/3 rounded bg-raised"></div>
            <div class="h-4 w-1/2 rounded bg-raised"></div>
          </div>
        </div>
      }
    </div>
  `
})
export class SkeletonCards {
  readonly count = input(3);
  protected rows(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
