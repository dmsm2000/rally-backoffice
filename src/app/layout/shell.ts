import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { appUrl } from '../core/format';
import { Dashboard } from '../core/models';
import { ModerationStore } from '../core/moderation-store';
import { Icon, IconName } from '../ui/icon';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  exact?: boolean;
  /** Which dashboard number to show next to it, and how loudly. */
  badge?: { count: (d: Dashboard) => number; tone: 'danger' | 'warn' };
}

interface NavSection {
  title: string | null;
  items: NavItem[];
}

@Component({
  selector: 'bo-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './shell.html'
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(ModerationStore);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly rallyUrl = appUrl('/');

  protected readonly sections: NavSection[] = [
    { title: null, items: [{ label: 'Painel', path: '/', icon: 'home', exact: true }] },
    {
      title: 'Moderação',
      items: [
        {
          label: 'Denúncias de campos',
          path: '/reports/courts',
          icon: 'courts',
          badge: { count: d => d.reported_courts, tone: 'danger' }
        },
        {
          label: 'Denúncias de publicações',
          path: '/reports/posts',
          icon: 'image',
          badge: { count: d => d.reported_posts, tone: 'danger' }
        }
      ]
    },
    {
      title: 'Comunidade',
      items: [
        { label: 'Jogadores', path: '/players', icon: 'users' },
        { label: 'Publicações', path: '/posts', icon: 'image' },
        { label: 'Partidas', path: '/matches', icon: 'matches' },
        { label: 'Viagens', path: '/trips', icon: 'world' }
      ]
    },
    {
      title: 'Catálogo',
      items: [
        {
          label: 'Locais',
          path: '/venues',
          icon: 'map-pin',
          badge: { count: d => d.venues_stale_draft, tone: 'warn' }
        }
      ]
    },
    { title: 'Lançamento', items: [{ label: 'Lista de espera', path: '/waitlist', icon: 'mail' }] },
    { title: 'Registo', items: [{ label: 'Histórico', path: '/activity', icon: 'clock' }] }
  ];

  protected readonly initials = computed(() => (this.auth.email().slice(0, 1) || '?').toUpperCase());

  constructor() {
    void this.store.refresh();

    // A session that expires or is revoked mid-use lands back on the login screen.
    effect(() => {
      if (this.auth.access() !== 'admin') {
        void this.router.navigateByUrl('/login');
      }
    });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected badgeCount(item: NavItem): number {
    const dashboard = this.store.dashboard();
    return item.badge && dashboard ? item.badge.count(dashboard) : 0;
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
