import { Routes } from '@angular/router';
import { adminGuard, loginGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: async () => (await import('./pages/login/login.page')).LoginPage
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: async () => (await import('./layout/shell')).Shell,
    children: [
      {
        path: '',
        loadComponent: async () => (await import('./pages/dashboard/dashboard.page')).DashboardPage
      },
      {
        path: 'reports/courts',
        loadComponent: async () => (await import('./pages/court-reports/court-reports.page')).CourtReportsPage
      },
      {
        path: 'reports/posts',
        loadComponent: async () => (await import('./pages/post-reports/post-reports.page')).PostReportsPage
      },
      {
        path: 'reports/bugs',
        loadComponent: async () => (await import('./pages/bug-reports/bug-reports.page')).BugReportsPage
      },
      {
        path: 'players',
        loadComponent: async () => (await import('./pages/players/players.page')).PlayersPage
      },
      {
        path: 'players/:id',
        loadComponent: async () => (await import('./pages/player-detail/player-detail.page')).PlayerDetailPage
      },
      {
        path: 'posts',
        loadComponent: async () => (await import('./pages/posts/posts.page')).PostsPage
      },
      {
        path: 'matches',
        loadComponent: async () => (await import('./pages/matches/matches.page')).MatchesPage
      },
      {
        path: 'trips',
        loadComponent: async () => (await import('./pages/trips/trips.page')).TripsPage
      },
      {
        path: 'venues',
        loadComponent: async () => (await import('./pages/venues/venues.page')).VenuesPage
      },
      {
        path: 'venues/new',
        loadComponent: async () => (await import('./pages/venue-new/venue-new.page')).VenueNewPage
      },
      {
        path: 'venues/:id',
        loadComponent: async () => (await import('./pages/venue-detail/venue-detail.page')).VenueDetailPage
      },
      {
        path: 'waitlist',
        loadComponent: async () => (await import('./pages/waitlist/waitlist.page')).WaitlistPage
      },
      {
        path: 'activity',
        loadComponent: async () => (await import('./pages/activity/activity.page')).ActivityPage
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
