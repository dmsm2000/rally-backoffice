import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { CountryData } from '../core/country-data';
import { INPUT, LABEL } from './styles';

let nextId = 0;

/**
 * Country + city inputs suggesting from the same dataset Rally uses, so what's saved here is spelled
 * the way the app spells it. Suggestions only: an unlisted value is still accepted, since existing rows
 * may predate the dataset. `flag` follows the country when it matches one.
 */
@Component({
  selector: 'bo-place-fields',
  host: { class: 'grid gap-4 sm:grid-cols-2' },
  template: `
    <label class="block space-y-1.5">
      <span [class]="label">{{ countryLabel() }}</span>
      <input
        type="text"
        autocomplete="off"
        [attr.list]="countriesId"
        [value]="country()"
        (input)="setCountry($any($event.target).value)"
        [required]="required()"
        [class]="input"
      />
      <datalist [id]="countriesId">
        @for (option of countryOptions(); track option.iso2) {
          <option [value]="option.name">{{ option.flag }}</option>
        }
      </datalist>
    </label>
    <label class="block space-y-1.5">
      <span [class]="label">{{ cityLabel() }}</span>
      <input
        type="text"
        autocomplete="off"
        [attr.list]="citiesId"
        [value]="city()"
        (input)="city.set($any($event.target).value)"
        [required]="required()"
        [class]="input"
      />
      <datalist [id]="citiesId">
        @for (option of cityOptions(); track option) {
          <option [value]="option"></option>
        }
      </datalist>
    </label>
  `
})
export class PlaceFields {
  private readonly data = inject(CountryData);

  readonly country = model('');
  readonly city = model('');
  readonly flag = model<string | null>(null);
  readonly required = input(true);
  readonly countryLabel = input('País');
  readonly cityLabel = input('Cidade');

  protected readonly label = LABEL;
  protected readonly input = INPUT;
  protected readonly countriesId = `bo-countries-${nextId}`;
  protected readonly citiesId = `bo-cities-${nextId++}`;

  private readonly cities = signal<string[]>([]);

  protected readonly countryOptions = computed(() => {
    const typed = this.country().trim().toLowerCase();
    const all = this.data.countries();
    return (typed ? all.filter(c => c.name.toLowerCase().includes(typed)) : all).slice(0, 60);
  });

  // A big country has thousands of cities; a datalist only needs the ones that match what's typed.
  protected readonly cityOptions = computed(() => {
    const typed = this.city().trim().toLowerCase();
    const all = this.cities();
    return (typed ? all.filter(c => c.toLowerCase().startsWith(typed)) : all).slice(0, 60);
  });

  constructor() {
    void this.data.loadCountries();
    effect(() => {
      this.data.countries();
      const match = this.data.byName(this.country());
      if (match) {
        this.flag.set(match.flag);
        void this.data.citiesFor(match.iso2).then(list => {
          if (this.data.byName(this.country())?.iso2 === match.iso2) {
            this.cities.set(list);
          }
        });
      } else {
        this.cities.set([]);
      }
    });
  }

  protected setCountry(value: string): void {
    this.country.set(value);
  }
}
