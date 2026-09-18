// Row shapes returned by the admin_* RPCs in rally-supabase's 0045_backoffice_moderation.sql and
// 0046_backoffice_crud.sql.

export type Resolution = 'dismissed' | 'actioned';
export type VenueStatus = 'draft' | 'live';

export interface Dashboard {
  open_court_reports: number;
  reported_courts: number;
  open_post_reports: number;
  reported_posts: number;
  court_report_reasons: Record<string, number>;
  post_report_reasons: Record<string, number>;
  players: number;
  players_last_7d: number;
  players_blocked: number;
  posts: number;
  posts_last_7d: number;
  venues_live: number;
  venues_draft: number;
  venues_stale_draft: number;
  courts: number;
  matches_upcoming: number;
  matches_open: number;
  matches_complete: number;
  trips_upcoming: number;
  waitlist: number;
  waitlist_last_7d: number;
  actions_last_7d: number;
  open_bug_reports: number;
}

/** A page of a paged list RPC; `total` is the row count before paging. */
export interface Page<T> {
  rows: T[];
  total: number;
}

export interface PlayerRow {
  id: string;
  member_number: number;
  first_name: string;
  last_name: string;
  email: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  blocked_at: string | null;
  block_reason: string | null;
  is_admin: boolean;
  posts: number;
  matches: number;
}

export interface PlayerDetail {
  id: string;
  member_number: number;
  first_name: string;
  last_name: string;
  email: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  gender: string | null;
  level: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  blocked_at: string | null;
  block_reason: string | null;
  counts: {
    posts: number;
    likes_received: number;
    matches: number;
    matches_complete: number;
    trips: number;
    venues: number;
    courts: number;
    photos: number;
    captures: number;
    open_reports_against: number;
    reports_filed: number;
  };
}

export interface PhotoDetail {
  id: string;
  url: string;
  vote_count: number;
  created_at: string;
  uploader_name: string | null;
}

export interface CourtDetail {
  id: string;
  number: string | null;
  surface: string;
  indoor: boolean;
  lights: boolean;
  capture_count: number;
  created_at: string;
  creator_name: string | null;
  open_reports: number;
  photos: PhotoDetail[];
}

export interface VenueDetail {
  id: string;
  name: string;
  kind: string;
  city: string;
  country: string;
  flag: string | null;
  access: string | null;
  hours: string | null;
  price: string | null;
  facilities: string[];
  lat: number;
  lng: number;
  registered_accuracy_m: number | null;
  status: VenueStatus;
  confirmations: number;
  verified_at: string | null;
  created_at: string;
  created_by: string | null;
  creator_name: string | null;
  courts: CourtDetail[];
}

/** What the venue create and edit forms send. */
export interface VenueInput {
  name: string;
  kind: string;
  city: string;
  country: string;
  flag: string | null;
  lat: number;
  lng: number;
  access: string | null;
  hours: string | null;
  price: string | null;
  facilities: string[];
}

export interface CourtInput {
  number: string | null;
  surface: string;
  indoor: boolean;
  lights: boolean;
}

export interface PostRow {
  id: string;
  author_id: string;
  author_name: string | null;
  author_member_number: number | null;
  post_text: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  post_type: string | null;
  kind: PostKind;
  linked_label: string | null;
  created_at: string;
  likes: number;
  open_reports: number;
}

export type MatchStatus = 'pending' | 'open' | 'upcoming' | 'cancelled' | 'complete';

export interface MatchRow {
  id: string;
  kind: 'direct' | 'open';
  status: MatchStatus;
  format: 'Singles' | 'Doubles';
  session_type: string | null;
  match_date: string;
  match_time: string;
  match_time_end: string | null;
  duration_minutes: number | null;
  city: string;
  country: string;
  note: string | null;
  /** Null once that player deleted their account (0048_delete_player.sql), like player_b on a played match. */
  player_a: string | null;
  player_a_name: string | null;
  player_b: string | null;
  player_b_name: string | null;
  participant_names: string[];
  winner: string | null;
  sets: [number, number][] | null;
  result_status: 'pending' | 'confirmed' | 'disputed' | null;
  played_seconds: number | null;
  keeps_score: boolean;
  court_venue_name: string | null;
  court_number: string | null;
  created_at: string;
}

export interface MatchInput {
  matchDate: string;
  matchTime: string;
  matchTimeEnd: string | null;
  durationMinutes: number | null;
  city: string;
  country: string;
  note: string | null;
}

export interface TripRow {
  id: string;
  player_id: string;
  player_name: string | null;
  player_member_number: number | null;
  destination_city: string;
  destination_country: string;
  from_date: string;
  to_date: string;
  note: string;
  hosts: number;
  host_names: string[];
  created_at: string;
}

export interface TripInput {
  country: string;
  city: string;
  fromDate: string;
  toDate: string;
  note: string;
}

export interface WaitlistRow {
  id: string;
  email: string;
  locale: string;
  created_at: string;
}

export type BugReportStatus = 'pending' | 'in_progress' | 'solved';

export interface BugReportRow {
  id: string;
  page: string;
  description: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  status: BugReportStatus;
  created_at: string;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_member_number: number | null;
}

interface ReportBase {
  id: string;
  reason: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: Resolution | null;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_member_number: number | null;
}

export interface CourtReport extends ReportBase {
  court_id: string;
  court_number: string | null;
  court_surface: string;
  court_indoor: boolean;
  court_capture_count: number;
  court_created_at: string;
  cover_url: string | null;
  venue_id: string;
  venue_name: string;
  venue_kind: string;
  venue_city: string;
  venue_country: string;
  venue_flag: string | null;
  venue_status: VenueStatus;
  venue_lat: number;
  venue_lng: number;
  venue_confirmations: number;
  venue_registered_accuracy_m: number | null;
  venue_court_count: number;
}

export type PostKind = 'authored' | 'trip' | 'match' | 'venue';

export interface PostReport extends ReportBase {
  post_id: string;
  post_text: string;
  post_media_url: string | null;
  post_media_type: 'image' | 'video' | null;
  post_type: string | null;
  post_kind: PostKind;
  post_created_at: string;
  author_id: string;
  author_name: string | null;
  author_member_number: number | null;
  author_city: string | null;
  author_country: string | null;
}

export interface Venue {
  id: string;
  name: string;
  kind: string;
  city: string;
  country: string;
  flag: string | null;
  status: VenueStatus;
  confirmations: number;
  registered_accuracy_m: number | null;
  lat: number;
  lng: number;
  created_at: string;
  verified_at: string | null;
  created_by: string | null;
  creator_name: string | null;
  creator_member_number: number | null;
  court_count: number;
  capture_total: number;
  open_reports: number;
  cover_url: string | null;
}

export type LogAction =
  | 'resolve_court_reports'
  | 'resolve_post_reports'
  | 'delete_post'
  | 'delete_court'
  | 'delete_venue'
  | 'update_player'
  | 'block_player'
  | 'unblock_player'
  | 'delete_player'
  | 'create_venue'
  | 'update_venue'
  | 'verify_venue'
  | 'create_court'
  | 'update_court'
  | 'add_court_photo'
  | 'delete_court_photo'
  | 'create_post'
  | 'update_post'
  | 'update_match'
  | 'cancel_match'
  | 'set_match_result'
  | 'delete_match'
  | 'update_trip'
  | 'delete_trip'
  | 'add_waitlist'
  | 'delete_waitlist'
  | 'update_bug_report_status';

export interface LogEntry {
  id: string;
  action: LogAction;
  target_id: string;
  summary: Record<string, unknown>;
  created_at: string;
  admin_id: string | null;
  admin_name: string | null;
}

/** Several reports about the same court or post, which is the unit moderation acts on. */
export interface ReportGroup<T extends ReportBase> {
  key: string;
  first: T;
  reports: T[];
  reasons: { reason: string; count: number }[];
  latest: string;
}

export function groupReports<T extends ReportBase>(rows: T[], keyOf: (row: T) => string): ReportGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([key, reports]) => {
      const counts = new Map<string, number>();
      for (const report of reports) {
        counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
      }
      return {
        key,
        first: reports[0],
        reports,
        reasons: [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
        latest: reports[0].created_at
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length || b.latest.localeCompare(a.latest));
}
