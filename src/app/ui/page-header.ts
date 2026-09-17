import { Component, input } from '@angular/core';

@Component({
  selector: 'bo-page-header',
  host: { class: 'block' },
  template: `
    <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="eyebrow text-lime">{{ eyebrow() }}</p>
        <h1 class="display mt-2 text-3xl sm:text-4xl">{{ title() }}</h1>
        @if (description()) {
          <p class="mt-2 max-w-2xl text-sm text-muted">{{ description() }}</p>
        }
      </div>
      <div class="flex shrink-0 flex-wrap gap-2">
        <ng-content />
      </div>
    </header>
  `
})
export class PageHeader {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string>();
}
