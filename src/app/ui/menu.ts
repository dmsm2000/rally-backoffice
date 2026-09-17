import { Component, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Icon } from './icon';
import { BTN_GHOST, MENU_PANEL } from './styles';

/** Gap between the trigger and the panel, in either direction — mirrors the old `mt-1.5`. */
const GAP = 6;
/** Keeps a flipped-up panel off the very top edge of the screen too. */
const VIEWPORT_MARGIN = 8;

/**
 * A row or section's actions behind one trigger, instead of a button group whose wrapping flips
 * between horizontal and vertical from one page to the next depending on width and item count.
 * Consumers project their own buttons/links; the panel closes on any click inside it (so an item
 * doesn't need to close it itself), on Escape, on scroll/resize, or on a click outside.
 *
 * The panel is positioned in fixed viewport coordinates rather than relative to the trigger,
 * because several places it's used (report cards, the venue/player hero) clip overflow for their
 * own rounded corners or thumbnails — an absolutely-positioned panel would be clipped right along
 * with it. It opens downward by default and flips above the trigger when there isn't room left
 * below (e.g. a row near the bottom of the page) — decided after measuring the panel's actual
 * rendered height, since that depends on how many actions the caller projected into it. Closing
 * on scroll, rather than tracking the trigger, keeps this simple: every scroll surface in the app
 * is the page itself, not an inner pane, so that's the one listener it needs.
 */
@Component({
  selector: 'bo-menu',
  exportAs: 'boMenu',
  imports: [Icon],
  host: {
    class: 'inline-block',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
    '(window:scroll)': 'close()',
    '(window:resize)': 'close()'
  },
  template: `
    <button #trigger type="button" (click)="toggle(trigger)" [attr.aria-expanded]="!!open()" aria-haspopup="menu" aria-label="Mais opções" title="Mais opções" [class]="triggerClass">
      <bo-icon name="more" />
    </button>
    @if (open(); as position) {
      <div
        #panel
        role="menu"
        [class]="panelClass"
        [style.visibility]="position.ready ? 'visible' : 'hidden'"
        [style.top.px]="position.top"
        [style.bottom.px]="position.bottom"
        [style.right.px]="position.right"
        (click)="close()"
      >
        <ng-content />
      </div>
    }
  `
})
export class Menu {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly open = signal<{ top?: number; bottom?: number; right: number; ready: boolean } | null>(null);
  protected readonly triggerClass = BTN_GHOST;
  protected readonly panelClass = MENU_PANEL;

  toggle(trigger: HTMLElement): void {
    if (this.open()) {
      this.close();
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    // Guess "below" and render hidden — its real height isn't known until it's in the DOM, so
    // the flip decision below re-measures it and swaps to "above" first if needed, before the
    // panel ever becomes visible.
    this.open.set({ top: rect.bottom + GAP, right, ready: false });
    afterNextRender(
      () => {
        const panelEl = this.panel()?.nativeElement;
        if (!panelEl || !this.open()) {
          return;
        }
        const height = panelEl.getBoundingClientRect().height;
        const fitsBelow = rect.bottom + GAP + height + VIEWPORT_MARGIN <= window.innerHeight;
        this.open.set(
          fitsBelow ? { top: rect.bottom + GAP, right, ready: true } : { bottom: window.innerHeight - rect.top + GAP, right, ready: true }
        );
      },
      { injector: this.injector }
    );
  }

  close(): void {
    this.open.set(null);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
