import { Injectable, signal } from '@angular/core';
import { getAllCitiesOfCountry, getCountries } from '@countrystatecity/countries-browser';

export interface Country {
  name: string;
  iso2: string;
  flag: string;
}

/**
 * The same dataset Rally's register/profile and court forms use, so a country or city typed here is
 * spelled exactly as the app spells it — feed scoping, the passport and "near you" all compare these
 * strings. Loaded lazily from its CDN and cached.
 */
@Injectable({ providedIn: 'root' })
export class CountryData {
  readonly countries = signal<Country[]>([]);

  private countriesPromise: Promise<Country[]> | null = null;
  private readonly cities = new Map<string, Promise<string[]>>();

  async loadCountries(): Promise<Country[]> {
    this.countriesPromise ??= getCountries()
      .then(list => {
        const mapped = list.map(c => ({ name: c.name, iso2: c.iso2, flag: c.emoji })).sort((a, b) => a.name.localeCompare(b.name));
        this.countries.set(mapped);
        return mapped;
      })
      .catch(() => {
        this.countriesPromise = null;
        return [];
      });
    return this.countriesPromise;
  }

  byName(name: string): Country | undefined {
    const wanted = name.trim().toLowerCase();
    return this.countries().find(country => country.name.toLowerCase() === wanted);
  }

  async citiesFor(iso2: string): Promise<string[]> {
    let entry = this.cities.get(iso2);
    if (!entry) {
      entry = getAllCitiesOfCountry(iso2)
        .then(list => [...new Set(list.map(city => city.name))].sort((a, b) => a.localeCompare(b)))
        .catch(() => {
          this.cities.delete(iso2);
          return [];
        });
      this.cities.set(iso2, entry);
    }
    return entry;
  }
}
