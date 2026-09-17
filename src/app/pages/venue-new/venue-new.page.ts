import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import { CourtInput } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { Icon } from '../../ui/icon';
import { PageHeader } from '../../ui/page-header';
import { BTN_GHOST, BTN_LINK, BTN_PRIMARY, CARD } from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';
import { CourtFields, EMPTY_COURT, EMPTY_VENUE, VenueDraft, VenueFields, venueInput } from '../venue-detail/venue-fields';

@Component({
  selector: 'bo-venue-new-page',
  imports: [RouterLink, Icon, PageHeader, VenueFields, CourtFields],
  template: `
    <a routerLink="/venues" [class]="styles.link" class="mb-6">
      <bo-icon name="arrow-left" />
      Locais
    </a>
    <bo-page-header
      eyebrow="Catálogo"
      title="Novo local"
      description="Fica verificado logo, sem GPS nem segundo jogador — é criado por ti. Não aparece anúncio no feed."
    />

    <form (submit)="$event.preventDefault(); create()">
      <section class="p-5 sm:p-6" [class]="styles.card">
        <h2 class="mb-4 font-bold">O local</h2>
        <bo-venue-fields [(draft)]="venue" />
      </section>

      <section class="mt-6 p-5 sm:p-6" [class]="styles.card">
        <h2 class="font-bold">Primeiro campo</h2>
        <p class="mt-1 mb-4 text-sm text-muted">Um local precisa de pelo menos um. Os outros juntam-se depois, na página do local.</p>
        <bo-court-fields [(court)]="court" />
      </section>

      <div class="mt-6 flex flex-col items-end gap-2">
        @if (problem(); as message) {
          <p class="text-sm text-muted">{{ message }}</p>
        }
        <div class="flex gap-2">
          <a routerLink="/venues" [class]="styles.ghost">Cancelar</a>
          <button type="submit" [disabled]="!!problem() || busy()" [class]="styles.primary">
            <bo-icon name="plus" />
            {{ busy() ? 'A criar…' : 'Criar local' }}
          </button>
        </div>
      </div>
    </form>
  `
})
export class VenueNewPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly venue = signal<VenueDraft>({ ...EMPTY_VENUE });
  protected readonly court = signal<CourtInput>({ ...EMPTY_COURT });
  protected readonly busy = signal(false);
  protected readonly problem = computed(() => {
    const input = venueInput(this.venue());
    return typeof input === 'string' ? input : null;
  });

  protected readonly styles = { card: CARD, ghost: BTN_GHOST, primary: BTN_PRIMARY, link: BTN_LINK };

  protected async create(): Promise<void> {
    const input = venueInput(this.venue());
    if (typeof input === 'string' || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const court = this.court();
      const id = await this.api.createVenue(input, { ...court, number: court.number?.trim() || null });
      this.toast.ok(`Local criado: ${input.name}.`);
      void this.store.refresh();
      void this.router.navigate(['/venues', id], { replaceUrl: true });
    } catch (error) {
      this.toast.error(error);
      this.busy.set(false);
    }
  }
}
