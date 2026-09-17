import { Injectable } from '@angular/core';
import { PostgrestError } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { isMissingFunction } from './auth.service';
import {
  CourtInput,
  CourtReport,
  Dashboard,
  LogEntry,
  MatchInput,
  MatchRow,
  Page,
  PlayerDetail,
  PlayerRow,
  PostReport,
  PostRow,
  Resolution,
  TripInput,
  TripRow,
  Venue,
  VenueDetail,
  VenueInput,
  VenueStatus,
  WaitlistRow
} from './models';
import { supabase } from './supabase';

export type Bucket = 'feed-media' | 'court-photos';
const STORAGE_BUCKETS: string[] = ['feed-media', 'court-photos'];

export interface DeleteOutcome {
  /** Files the deleted rows pointed at that couldn't be removed from Storage. */
  filesLeft: number;
}

// Raised by the RPCs (`raise exception '...'`) or named in a constraint violation → what to show.
const KNOWN_ERRORS: [RegExp, string][] = [
  [/cannot (block|delete) an admin/i, 'Não é possível fazer isto a uma conta de admin.'],
  [/player is not blocked/i, 'Este jogador já não está bloqueado.'],
  [/first and last name are required/i, 'O nome e o apelido são obrigatórios.'],
  [/bio too long|reason too long/i, 'O texto passa dos 500 caracteres.'],
  [/admin account has no Rally profile/i, 'A tua conta de admin não tem perfil no Rally — cria-o na app primeiro.'],
  [/text too long/i, 'O texto passa dos 280 caracteres.'],
  [/court photo limit reached/i, 'Este campo já tem 10 fotos.'],
  [/courts_venue_number_idx/i, 'Já existe um campo com esse número neste local.'],
  [/venues_name_check/i, 'O nome tem de ter entre 2 e 120 caracteres.'],
  [/city and country are required|destination is required/i, 'O país e a cidade são obrigatórios.'],
  [/coordinates are required/i, 'Faltam as coordenadas.'],
  [/unknown facility/i, 'Há uma comodidade que não existe.'],
  [/venue cannot be verified/i, 'Este local já está verificado.'],
  [/matches_time_range_valid/i, 'A hora de fim tem de ser depois da hora de início.'],
  [/trip_intents_date_range/i, 'A data de regresso não pode ser antes da de partida.'],
  [/date and time are required|dates are required/i, 'Faltam datas.'],
  [/invalid duration/i, 'A duração tem de estar entre 1 e 1440 minutos.'],
  [/match cannot be cancelled/i, 'Esta partida já não pode ser cancelada.'],
  [/match has no result to edit/i, 'Esta partida não tem resultado para editar.'],
  [/winner must be one of the players/i, 'O vencedor tem de ser um dos jogadores.'],
  [/invalid sets|matches_sets_valid/i, 'Os sets não são válidos (1 a 6, números inteiros).'],
  [/posts_has_content/i, 'Uma publicação precisa de texto ou de uma foto/vídeo.'],
  [/landing_waitlist_email_check/i, 'Esse email não é válido.'],
  [/must be in the (court-photos|feed-media) bucket/i, 'O ficheiro não está no sítio certo do Storage.']
];

function friendlyError(error: PostgrestError): string {
  if (isMissingFunction(error)) {
    return 'Função em falta na base de dados — aplica as migrações do backoffice (0045 e 0046).';
  }
  if (error.code === '42501') {
    return 'Sem permissão: esta conta não é admin.';
  }
  const text = `${error.message} ${error.details ?? ''}`;
  const known = KNOWN_ERRORS.find(([pattern]) => pattern.test(text));
  if (known) {
    return known[1];
  }
  if (/not found/i.test(error.message)) {
    return 'Já não existe — talvez tenha sido apagado entretanto.';
  }
  return error.message;
}

function page<T extends { total_count?: number }>(rows: T[] | null): Page<Omit<T, 'total_count'>> {
  const list = rows ?? [];
  return { rows: list, total: Number(list[0]?.total_count ?? 0) };
}

/** `{bucket, path}` for a public Storage URL of this project, or null for anything else. */
export function storageObject(url: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(environment.supabaseUrl).origin) {
      return null;
    }
    const match = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(parsed.pathname);
    if (!match || !STORAGE_BUCKETS.includes(match[1])) {
      return null;
    }
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  // ---- Dashboard, reports, log (0045) ----

  async dashboard(): Promise<Dashboard> {
    return this.call<Dashboard>('admin_dashboard');
  }

  async courtReports(open: boolean): Promise<CourtReport[]> {
    return this.call<CourtReport[]>('admin_court_reports', { p_open: open });
  }

  async postReports(open: boolean): Promise<PostReport[]> {
    return this.call<PostReport[]>('admin_post_reports', { p_open: open });
  }

  async venues(status: VenueStatus | null = null): Promise<Venue[]> {
    return this.call<Venue[]>('admin_venues', { p_status: status });
  }

  async log(limit = 200): Promise<LogEntry[]> {
    return this.call<LogEntry[]>('admin_moderation_log', { p_limit: limit });
  }

  async resolveCourtReports(courtId: string, resolution: Resolution): Promise<number> {
    return this.call<number>('admin_resolve_court_reports', { p_court_id: courtId, p_resolution: resolution });
  }

  async resolvePostReports(postId: string, resolution: Resolution): Promise<number> {
    return this.call<number>('admin_resolve_post_reports', { p_post_id: postId, p_resolution: resolution });
  }

  async deletePost(postId: string): Promise<DeleteOutcome> {
    const mediaUrl = await this.call<string | null>('admin_delete_post', { p_post_id: postId });
    return { filesLeft: await this.removeFiles(mediaUrl ? [mediaUrl] : []) };
  }

  async deleteCourt(courtId: string): Promise<DeleteOutcome & { venueDeleted: boolean }> {
    const result = await this.call<{ photo_urls: string[]; venue_deleted: boolean }>('admin_delete_court', {
      p_court_id: courtId
    });
    return { venueDeleted: result.venue_deleted, filesLeft: await this.removeFiles(result.photo_urls) };
  }

  async deleteVenue(venueId: string): Promise<DeleteOutcome & { courts: number }> {
    const result = await this.call<{ photo_urls: string[]; courts: number }>('admin_delete_venue', { p_venue_id: venueId });
    return { courts: result.courts, filesLeft: await this.removeFiles(result.photo_urls) };
  }

  // ---- Players ----

  async players(search: string, filter: 'all' | 'blocked' | 'recent', limit: number, offset: number): Promise<Page<PlayerRow>> {
    return page(
      await this.call<(PlayerRow & { total_count: number })[]>('admin_players', {
        p_search: search || null,
        p_filter: filter,
        p_limit: limit,
        p_offset: offset
      })
    );
  }

  async player(id: string): Promise<PlayerDetail> {
    return this.call<PlayerDetail>('admin_player', { p_player_id: id });
  }

  async updatePlayer(
    id: string,
    input: { firstName: string; lastName: string; bio: string; city: string; country: string }
  ): Promise<void> {
    await this.call('admin_update_player', {
      p_player_id: id,
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_bio: input.bio,
      p_city: input.city,
      p_country: input.country
    });
  }

  async blockPlayer(id: string, reason: string): Promise<void> {
    await this.call('admin_block_player', { p_player_id: id, p_reason: reason || null });
  }

  async unblockPlayer(id: string): Promise<void> {
    await this.call('admin_unblock_player', { p_player_id: id });
  }

  async deletePlayer(id: string): Promise<DeleteOutcome> {
    const result = await this.call<{ files: { bucket: string; path: string }[] }>('admin_delete_player', { p_player_id: id });
    return { filesLeft: await this.removePaths(result.files) };
  }

  // ---- Venues, courts, photos ----

  async venue(id: string): Promise<VenueDetail> {
    return this.call<VenueDetail>('admin_venue', { p_venue_id: id });
  }

  async createVenue(venue: VenueInput, court: CourtInput): Promise<string> {
    return this.call<string>('admin_create_venue', {
      ...this.venueArgs(venue),
      p_court_number: court.number,
      p_court_surface: court.surface,
      p_court_indoor: court.indoor,
      p_court_lights: court.lights
    });
  }

  async updateVenue(id: string, venue: VenueInput): Promise<void> {
    await this.call('admin_update_venue', { p_venue_id: id, ...this.venueArgs(venue) });
  }

  async verifyVenue(id: string): Promise<void> {
    await this.call('admin_verify_venue', { p_venue_id: id });
  }

  async createCourt(venueId: string, court: CourtInput): Promise<string> {
    return this.call<string>('admin_create_court', { p_venue_id: venueId, ...this.courtArgs(court) });
  }

  async updateCourt(id: string, court: CourtInput): Promise<void> {
    await this.call('admin_update_court', { p_court_id: id, ...this.courtArgs(court) });
  }

  async addCourtPhoto(courtId: string, file: File): Promise<void> {
    const url = await this.upload('court-photos', file);
    try {
      await this.call('admin_add_court_photo', { p_court_id: courtId, p_url: url });
    } catch (error) {
      await this.removeFiles([url]);
      throw error;
    }
  }

  async deleteCourtPhoto(photoId: string): Promise<DeleteOutcome> {
    const url = await this.call<string>('admin_delete_court_photo', { p_photo_id: photoId });
    return { filesLeft: await this.removeFiles([url]) };
  }

  // ---- Posts ----

  async posts(
    filters: { search: string; kind: 'all' | 'authored' | 'announcement'; author: string | null; reported: boolean },
    limit: number,
    offset: number
  ): Promise<Page<PostRow>> {
    return page(
      await this.call<(PostRow & { total_count: number })[]>('admin_posts', {
        p_search: filters.search || null,
        p_kind: filters.kind,
        p_author: filters.author,
        p_reported: filters.reported,
        p_limit: limit,
        p_offset: offset
      })
    );
  }

  async createPost(text: string, type: string | null, file: File | null): Promise<void> {
    const mediaUrl = file ? await this.upload('feed-media', file) : null;
    try {
      await this.call('admin_create_post', {
        p_text: text,
        p_type: type,
        p_media_url: mediaUrl,
        p_media_type: file ? (file.type.startsWith('video/') ? 'video' : 'image') : null
      });
    } catch (error) {
      if (mediaUrl) {
        await this.removeFiles([mediaUrl]);
      }
      throw error;
    }
  }

  async updatePost(id: string, text: string, type: string | null): Promise<void> {
    await this.call('admin_update_post', { p_post_id: id, p_text: text, p_type: type });
  }

  // ---- Matches ----

  async matches(filters: { search: string; status: string | null; player: string | null }, limit: number, offset: number): Promise<Page<MatchRow>> {
    return page(
      await this.call<(MatchRow & { total_count: number })[]>('admin_matches', {
        p_search: filters.search || null,
        p_status: filters.status,
        p_player: filters.player,
        p_limit: limit,
        p_offset: offset
      })
    );
  }

  async updateMatch(id: string, input: MatchInput): Promise<void> {
    await this.call('admin_update_match', {
      p_match_id: id,
      p_match_date: input.matchDate,
      p_match_time: input.matchTime,
      p_match_time_end: input.matchTimeEnd,
      p_duration_minutes: input.durationMinutes,
      p_city: input.city,
      p_country: input.country,
      p_note: input.note
    });
  }

  async cancelMatch(id: string): Promise<void> {
    await this.call('admin_cancel_match', { p_match_id: id });
  }

  async setMatchResult(id: string, winner: string | null, sets: [number, number][] | null): Promise<void> {
    await this.call('admin_set_match_result', { p_match_id: id, p_winner: winner, p_sets: sets });
  }

  async deleteMatch(id: string): Promise<void> {
    await this.call('admin_delete_match', { p_match_id: id });
  }

  // ---- Trips ----

  async trips(filters: { search: string; when: 'upcoming' | 'past' | 'all'; player: string | null }, limit: number, offset: number): Promise<Page<TripRow>> {
    return page(
      await this.call<(TripRow & { total_count: number })[]>('admin_trips', {
        p_search: filters.search || null,
        p_when: filters.when,
        p_player: filters.player,
        p_limit: limit,
        p_offset: offset
      })
    );
  }

  async updateTrip(id: string, input: TripInput): Promise<void> {
    await this.call('admin_update_trip', {
      p_trip_id: id,
      p_destination_country: input.country,
      p_destination_city: input.city,
      p_from_date: input.fromDate,
      p_to_date: input.toDate,
      p_note: input.note
    });
  }

  async deleteTrip(id: string): Promise<void> {
    await this.call('admin_delete_trip', { p_trip_id: id });
  }

  // ---- Waitlist ----

  async waitlist(search: string, limit: number, offset: number): Promise<Page<WaitlistRow>> {
    return page(
      await this.call<(WaitlistRow & { total_count: number })[]>('admin_waitlist', {
        p_search: search || null,
        p_limit: limit,
        p_offset: offset
      })
    );
  }

  /** False when the address was already on the list. */
  async addToWaitlist(email: string, locale: string): Promise<boolean> {
    return this.call<boolean>('admin_add_waitlist', { p_email: email, p_locale: locale });
  }

  async deleteFromWaitlist(id: string): Promise<void> {
    await this.call('admin_delete_waitlist', { p_id: id });
  }

  // ---- Internals ----

  private venueArgs(venue: VenueInput): Record<string, unknown> {
    return {
      p_name: venue.name,
      p_kind: venue.kind,
      p_city: venue.city,
      p_country: venue.country,
      p_flag: venue.flag,
      p_lat: venue.lat,
      p_lng: venue.lng,
      p_access: venue.access,
      p_hours: venue.hours,
      p_price: venue.price,
      p_facilities: venue.facilities
    };
  }

  private courtArgs(court: CourtInput): Record<string, unknown> {
    return { p_number: court.number, p_surface: court.surface, p_indoor: court.indoor, p_lights: court.lights };
  }

  private async call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      throw new Error(friendlyError(error));
    }
    return data as T;
  }

  /** Into the admin's own folder — the only place the buckets' policies let any account write. */
  private async upload(bucket: Bucket, file: File): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) {
      throw new Error('A sessão expirou — entra outra vez.');
    }
    const extension = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${uid}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
    if (error) {
      throw new Error(`Não foi possível carregar o ficheiro: ${error.message}`);
    }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  // The rows are already gone by the time this runs, so a failure here only leaves an orphaned file —
  // it's reported, never thrown. Storage answers a policy refusal with fewer removed objects, not an error.
  private async removeFiles(urls: string[]): Promise<number> {
    return this.removePaths(urls.map(url => storageObject(url)).filter((object): object is { bucket: string; path: string } => !!object));
  }

  private async removePaths(objects: { bucket: string; path: string }[]): Promise<number> {
    const byBucket = new Map<string, string[]>();
    for (const object of objects) {
      if (STORAGE_BUCKETS.includes(object.bucket)) {
        byBucket.set(object.bucket, [...(byBucket.get(object.bucket) ?? []), object.path]);
      }
    }
    let left = 0;
    for (const [bucket, paths] of byBucket) {
      const { data, error } = await supabase.storage.from(bucket).remove(paths);
      left += error ? paths.length : paths.length - (data?.length ?? 0);
    }
    return left;
  }
}
