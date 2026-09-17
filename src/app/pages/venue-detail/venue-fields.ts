import { Component, computed, model } from '@angular/core';
import { ACCESS_OPTIONS, FACILITIES, SURFACES, VENUE_KINDS, mapsUrl, options } from '../../core/format';
import { CourtInput, VenueDetail, VenueInput } from '../../core/models';
import { Icon } from '../../ui/icon';
import { PlaceFields } from '../../ui/place-fields';
import { BTN_LINK, CHIP, CHIP_ACTIVE, CHIP_IDLE, INPUT, LABEL } from '../../ui/styles';

export interface VenueDraft {
  name: string;
  kind: string;
  country: string;
  city: string;
  flag: string | null;
  lat: string;
  lng: string;
  access: string;
  hours: string;
  price: string;
  facilities: string[];
}

export const EMPTY_VENUE: VenueDraft = {
  name: '',
  kind: 'club',
  country: 'Portugal',
  city: '',
  flag: '🇵🇹',
  lat: '',
  lng: '',
  access: '',
  hours: '',
  price: '',
  facilities: []
};

export function venueDraft(venue: VenueDetail): VenueDraft {
  return {
    name: venue.name,
    kind: venue.kind,
    country: venue.country,
    city: venue.city,
    flag: venue.flag,
    lat: String(venue.lat),
    lng: String(venue.lng),
    access: venue.access ?? '',
    hours: venue.hours ?? '',
    price: venue.price ?? '',
    facilities: [...venue.facilities]
  };
}

function coordinate(text: string, limit: number): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

/** The input to send, or the reason it can't be sent yet. */
export function venueInput(draft: VenueDraft): VenueInput | string {
  const lat = coordinate(draft.lat, 90);
  const lng = coordinate(draft.lng, 180);
  if (draft.name.trim().length < 2) {
    return 'O nome tem de ter pelo menos 2 caracteres.';
  }
  if (!draft.country.trim() || !draft.city.trim()) {
    return 'Falta o país ou a cidade.';
  }
  if (lat === null || lng === null) {
    return 'As coordenadas não são válidas.';
  }
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    country: draft.country.trim(),
    city: draft.city.trim(),
    flag: draft.flag,
    lat,
    lng,
    access: draft.access || null,
    hours: draft.hours.trim() || null,
    price: draft.price.trim() || null,
    facilities: draft.facilities
  };
}

@Component({
  selector: 'bo-venue-fields',
  imports: [Icon, PlaceFields],
  host: { class: 'block space-y-4' },
  template: `
    <div class="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <label class="block space-y-1.5">
        <span [class]="label">Nome</span>
        <input type="text" maxlength="120" [value]="draft().name" (input)="patch({ name: $any($event.target).value })" [class]="input" />
      </label>
      <label class="block space-y-1.5">
        <span [class]="label">Tipo</span>
        <select class="bo-select" [value]="draft().kind" (change)="patch({ kind: $any($event.target).value })" [class]="input">
          @for (option of kinds; track option.value) {
            <option [value]="option.value" [selected]="option.value === draft().kind">{{ option.label }}</option>
          }
        </select>
      </label>
    </div>

    <bo-place-fields
      [country]="draft().country"
      (countryChange)="patch({ country: $event })"
      [city]="draft().city"
      (cityChange)="patch({ city: $event })"
      [flag]="draft().flag"
      (flagChange)="patch({ flag: $event })"
    />

    <div>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block space-y-1.5">
          <span [class]="label">Latitude</span>
          <input type="text" inputmode="decimal" placeholder="41.1496" [value]="draft().lat" (input)="setCoordinate('lat', $any($event.target).value)" [class]="input" />
        </label>
        <label class="block space-y-1.5">
          <span [class]="label">Longitude</span>
          <input type="text" inputmode="decimal" placeholder="-8.6109" [value]="draft().lng" (input)="setCoordinate('lng', $any($event.target).value)" [class]="input" />
        </label>
      </div>
      <p class="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-faint">
        Dá para colar "41.1496, -8.6109" do Google Maps num dos campos.
        @if (mapLink(); as link) {
          <a [href]="link" target="_blank" rel="noopener" [class]="linkClass" class="text-xs">
            <bo-icon name="map-pin" size="size-3.5" />
            Confirmar no mapa
          </a>
        }
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <label class="block space-y-1.5">
        <span [class]="label">Acesso</span>
        <select class="bo-select" [value]="draft().access" (change)="patch({ access: $any($event.target).value })" [class]="input">
          <option value="" [selected]="!draft().access">Não indicado</option>
          @for (option of access; track option.value) {
            <option [value]="option.value" [selected]="option.value === draft().access">{{ option.label }}</option>
          }
        </select>
      </label>
      <label class="block space-y-1.5">
        <span [class]="label">Horário</span>
        <input type="text" maxlength="120" placeholder="8h–22h" [value]="draft().hours" (input)="patch({ hours: $any($event.target).value })" [class]="input" />
      </label>
      <label class="block space-y-1.5">
        <span [class]="label">Preço</span>
        <input type="text" maxlength="120" placeholder="12 €/hora" [value]="draft().price" (input)="patch({ price: $any($event.target).value })" [class]="input" />
      </label>
    </div>

    <fieldset>
      <legend [class]="label">Comodidades</legend>
      <div class="mt-2 flex flex-wrap gap-2">
        @for (option of facilities; track option.value) {
          <button
            type="button"
            (click)="toggleFacility(option.value)"
            [attr.aria-pressed]="draft().facilities.includes(option.value)"
            [class]="chip + ' ' + (draft().facilities.includes(option.value) ? chipActive : chipIdle)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </fieldset>
  `
})
export class VenueFields {
  readonly draft = model.required<VenueDraft>();

  protected readonly kinds = options(VENUE_KINDS);
  protected readonly access = options(ACCESS_OPTIONS);
  protected readonly facilities = options(FACILITIES);
  protected readonly label = LABEL;
  protected readonly input = INPUT;
  protected readonly chip = CHIP;
  protected readonly chipActive = CHIP_ACTIVE;
  protected readonly chipIdle = CHIP_IDLE;
  protected readonly linkClass = BTN_LINK;

  protected readonly mapLink = computed(() => {
    const input = venueInput(this.draft());
    return typeof input === 'string' ? null : mapsUrl(input.lat, input.lng);
  });

  protected patch(change: Partial<VenueDraft>): void {
    this.draft.update(draft => ({ ...draft, ...change }));
  }

  protected setCoordinate(field: 'lat' | 'lng', text: string): void {
    const pair = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
    this.patch(pair ? { lat: pair[1], lng: pair[2] } : { [field]: text });
  }

  protected toggleFacility(value: string): void {
    const current = this.draft().facilities;
    this.patch({ facilities: current.includes(value) ? current.filter(f => f !== value) : [...current, value] });
  }
}

export const EMPTY_COURT: CourtInput = { number: '', surface: 'Hard', indoor: false, lights: false };

@Component({
  selector: 'bo-court-fields',
  host: { class: 'block' },
  template: `
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block space-y-1.5">
        <span [class]="label">Número ou nome</span>
        <input type="text" maxlength="40" placeholder="1, Central…" [value]="court().number ?? ''" (input)="patch({ number: $any($event.target).value })" [class]="input" />
      </label>
      <label class="block space-y-1.5">
        <span [class]="label">Piso</span>
        <select class="bo-select" [value]="court().surface" (change)="patch({ surface: $any($event.target).value })" [class]="input">
          @for (option of surfaces; track option.value) {
            <option [value]="option.value" [selected]="option.value === court().surface">{{ option.label }}</option>
          }
        </select>
      </label>
    </div>
    <div class="mt-4 flex flex-wrap gap-5">
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" class="size-4 accent-lime" [checked]="court().indoor" (change)="patch({ indoor: $any($event.target).checked })" />
        Interior
      </label>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" class="size-4 accent-lime" [checked]="court().lights" (change)="patch({ lights: $any($event.target).checked })" />
        Iluminação
      </label>
    </div>
  `
})
export class CourtFields {
  readonly court = model.required<CourtInput>();

  protected readonly surfaces = options(SURFACES);
  protected readonly label = LABEL;
  protected readonly input = INPUT;

  protected patch(change: Partial<CourtInput>): void {
    this.court.update(court => ({ ...court, ...change }));
  }
}
