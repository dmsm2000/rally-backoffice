import { Injectable, inject, signal } from '@angular/core';
import { AdminApi } from './admin-api';
import { Dashboard } from './models';

/** The dashboard numbers, shared so the sidebar badges and the dashboard page never disagree. */
@Injectable({ providedIn: 'root' })
export class ModerationStore {
  private readonly api = inject(AdminApi);

  readonly dashboard = signal<Dashboard | null>(null);
  readonly error = signal<string | null>(null);

  async refresh(): Promise<void> {
    try {
      this.dashboard.set(await this.api.dashboard());
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}
