import { HttpClient } from '@angular/common/http';
import { Component, Injectable, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

export type IconName =
  | 'home'
  | 'flag'
  | 'courts'
  | 'image'
  | 'video'
  | 'map-pin'
  | 'trash'
  | 'check'
  | 'close'
  | 'menu'
  | 'clock'
  | 'search'
  | 'eye'
  | 'link'
  | 'shield-check'
  | 'error-circle'
  | 'arrow-left'
  | 'chevron-down'
  | 'world'
  | 'tennis-ball'
  | 'matches'
  | 'note'
  | 'undo'
  | 'log-out'
  | 'refresh'
  | 'external'
  | 'users'
  | 'ban'
  | 'download'
  | 'chevron-right'
  | 'mail'
  | 'plus'
  | 'pencil'
  | 'camera'
  | 'calendar'
  | 'more';

/** Fetches public/icons/<name>.svg once and caches the markup — the same approach as Rally's ui-icon. */
@Injectable({ providedIn: 'root' })
export class IconRegistry {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cache = new Map<IconName, Promise<SafeHtml>>();

  async load(name: IconName): Promise<SafeHtml> {
    let entry = this.cache.get(name);
    if (!entry) {
      entry = firstValueFrom(this.http.get(`icons/${name}.svg`, { responseType: 'text' })).then(svg =>
        this.sanitizer.bypassSecurityTrustHtml(svg)
      );
      this.cache.set(name, entry);
    }
    return entry;
  }
}

@Component({
  selector: 'bo-icon',
  template: `<span class="bo-icon block" [class]="size()" [innerHTML]="svg()"></span>`,
  host: { class: 'contents' }
})
export class Icon {
  private readonly registry = inject(IconRegistry);

  readonly name = input.required<IconName>();
  readonly size = input('size-4');

  protected readonly svg = signal<SafeHtml | null>(null);

  constructor() {
    effect(() => {
      const name = this.name();
      void this.registry.load(name).then(svg => this.svg.set(svg));
    });
  }
}
