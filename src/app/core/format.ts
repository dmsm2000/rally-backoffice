import { environment } from '../../environments/environment';

export type Tone = 'danger' | 'warn' | 'cobalt' | 'clay' | 'lime' | 'ok' | 'neutral';

// Labels match Rally's own pt.ts, so a report reads the same here as where it was filed.
export const COURT_REASONS: Partial<Record<string, { label: string; tone: Tone }>> = {
  no_longer_exists: { label: 'Já não existe', tone: 'danger' },
  not_a_court: { label: 'Não é um campo de ténis', tone: 'danger' },
  duplicate: { label: 'É um duplicado', tone: 'warn' },
  wrong_details: { label: 'Os dados estão errados', tone: 'cobalt' },
  other: { label: 'Outro', tone: 'neutral' }
};

export const POST_REASONS: Partial<Record<string, { label: string; tone: Tone }>> = {
  harassment: { label: 'Assédio ou ataque pessoal', tone: 'danger' },
  inappropriate: { label: 'Conteúdo impróprio', tone: 'danger' },
  spam: { label: 'É spam', tone: 'warn' },
  not_tennis: { label: 'Não tem nada a ver com ténis', tone: 'cobalt' },
  other: { label: 'Outro', tone: 'neutral' }
};

export const SURFACES: Partial<Record<string, string>> = {
  Clay: 'Terra batida',
  Hard: 'Rápido',
  Grass: 'Relva',
  Carpet: 'Alcatifa'
};

export const VENUE_KINDS: Partial<Record<string, string>> = {
  club: 'Clube',
  public: 'Público',
  hotel: 'Hotel',
  condo: 'Condomínio',
  other: 'Outro'
};

export const POST_KINDS: Partial<Record<string, string>> = {
  authored: 'Publicação',
  trip: 'Anúncio de viagem',
  match: 'Anúncio de partida',
  venue: 'Anúncio de local'
};

export const POST_TYPES: Partial<Record<string, string>> = {
  outfit: 'Outfit',
  material: 'Material',
  highlight: 'Destaque',
  spot: 'Spot',
  other: 'Outro'
};

export const ACCESS_OPTIONS: Partial<Record<string, string>> = {
  free: 'Gratuito',
  paid: 'Pago',
  members: 'Só sócios',
  guest: 'Aberto a convidados'
};

export const FACILITIES: Partial<Record<string, string>> = {
  showers: 'Balneários',
  lights: 'Iluminação',
  parking: 'Estacionamento',
  bar: 'Bar',
  rackets: 'Aluguer de raquetes',
  shop: 'Loja',
  wheelchair: 'Acesso sem degraus'
};

export const FORMATS: Partial<Record<string, string>> = {
  Singles: 'Singulares',
  Doubles: 'Pares'
};

export const SESSION_TYPES: Partial<Record<string, string>> = {
  Training: 'Treino',
  HittingSession: 'Bater bolas',
  PracticeMatch: 'Jogo de treino',
  FullMatch: 'Jogo'
};

export const MATCH_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'A aguardar resposta', tone: 'warn' },
  open: { label: 'Em aberto', tone: 'cobalt' },
  upcoming: { label: 'Agendada', tone: 'lime' },
  complete: { label: 'Terminada', tone: 'ok' },
  cancelled: { label: 'Cancelada', tone: 'neutral' }
};

export const RESULT_STATUS: Partial<Record<string, { label: string; tone: Tone }>> = {
  pending: { label: 'Resultado por confirmar', tone: 'warn' },
  confirmed: { label: 'Resultado confirmado', tone: 'ok' },
  disputed: { label: 'Resultado contestado', tone: 'danger' }
};

// Matches the Rally app's own nav/bugReport.page* copy (rally/CLAUDE.md, Bug Reporting), so a
// report reads the same here as where it was filed.
export const BUG_REPORT_PAGES: Partial<Record<string, string>> = {
  home: 'Início',
  world: 'Explorar',
  courts: 'Courts',
  matches: 'Partidas',
  passport: 'Passaporte',
  profile: 'Perfil',
  messages: 'Mensagens',
  auth: 'Login / Registo',
  other: 'Outra'
};

export const BUG_REPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pendente', tone: 'warn' },
  in_progress: { label: 'Em progresso', tone: 'cobalt' },
  solved: { label: 'Resolvido', tone: 'ok' }
};

export const LOCALES: Partial<Record<string, string>> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol'
};

/** Picker-ready `[value, label]` pairs from one of the label maps above, in declaration order. */
export function options(labels: Partial<Record<string, string>>): { value: string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label: label ?? value }));
}

export const TONE_CLASSES: Record<Tone, string> = {
  danger: 'border-danger/35 bg-danger/12 text-danger',
  warn: 'border-warn/35 bg-warn/12 text-warn',
  cobalt: 'border-cobalt/40 bg-cobalt/15 text-cobalt',
  clay: 'border-clay/40 bg-clay/15 text-clay',
  lime: 'border-lime/35 bg-lime/12 text-lime',
  ok: 'border-ok/35 bg-ok/12 text-ok',
  neutral: 'border-line bg-raised text-muted'
};

export const BAR_CLASSES: Record<Tone, string> = {
  danger: 'bg-danger',
  warn: 'bg-warn',
  cobalt: 'bg-cobalt',
  clay: 'bg-clay',
  lime: 'bg-lime',
  ok: 'bg-ok',
  neutral: 'bg-faint'
};

const LOCALE = 'pt-PT';
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const number = new Intl.NumberFormat(LOCALE);

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60]
];

export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return 'agora mesmo';
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
}

export function memberNumber(value: number | null | undefined): string {
  return value == null ? '' : `#${String(value).padStart(6, '0')}`;
}

/** "Campo 3" for a numeric court name, the name itself otherwise — the same rule as Rally's court page. */
export function courtLabel(number: string | null): string {
  if (!number) {
    return 'Campo sem número';
  }
  return /^\d+$/.test(number.trim()) ? `Campo ${number.trim()}` : number;
}

/** "2026-09-17" → "17 set 2026", without the timezone shift `new Date('2026-09-17')` would add. */
export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return date.format(new Date(year, month - 1, day));
}

/** "18:00:00" → "18:00". */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

export function formatSets(sets: [number, number][] | null | undefined): string {
  return (sets ?? []).map(([a, b]) => `${a}-${b}`).join(' ');
}

export function playerName(name: string | null | undefined): string {
  return name ?? 'Conta apagada';
}

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  return `${(first ?? '').trim().charAt(0)}${(last ?? '').trim().charAt(0)}`.toUpperCase() || '?';
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function appUrl(path: string): string {
  return `${environment.rallyAppUrl.replace(/\/+$/, '')}${path}`;
}
