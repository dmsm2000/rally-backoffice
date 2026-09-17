import { Component, OnDestroy, computed, input, model, output } from '@angular/core';
import { Icon } from './icon';
import { BTN_GHOST, INPUT } from './styles';

/** A search box that writes its model 300 ms after typing stops, so each keystroke isn't a request. */
@Component({
  selector: 'bo-search',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <label class="relative block">
      <span class="sr-only">{{ placeholder() }}</span>
      <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"><bo-icon name="search" /></span>
      <input
        type="search"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($any($event.target).value)"
        [class]="input"
        class="pl-9"
      />
    </label>
  `
})
export class SearchBox implements OnDestroy {
  readonly value = model('');
  readonly placeholder = input('Pesquisar');

  protected readonly input = INPUT;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  protected onInput(text: string): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.value.set(text.trim()), 300);
  }
}

@Component({
  selector: 'bo-pager',
  host: { class: 'block' },
  template: `
    @if (total() > limit()) {
      <div class="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
        <span>{{ from() }}–{{ to() }} de {{ total() }}</span>
        <div class="flex gap-2">
          <button type="button" [class]="button" [disabled]="offset() === 0" (click)="page.emit(offset() - limit())">Anterior</button>
          <button type="button" [class]="button" [disabled]="to() >= total()" (click)="page.emit(offset() + limit())">Seguinte</button>
        </div>
      </div>
    }
  `
})
export class Pager {
  readonly total = input.required<number>();
  readonly offset = input.required<number>();
  readonly limit = input.required<number>();
  readonly page = output<number>();

  protected readonly button = BTN_GHOST;
  protected readonly from = computed(() => Math.min(this.offset() + 1, this.total()));
  protected readonly to = computed(() => Math.min(this.offset() + this.limit(), this.total()));
}
