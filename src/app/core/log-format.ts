import { IconName } from '../ui/icon';
import { COURT_REASONS, POST_REASONS, Tone, courtLabel, formatDay, formatSets, formatTime } from './format';
import { LogAction, LogEntry } from './models';

export type LogCategory = 'moderation' | 'create' | 'update' | 'delete';

export const LOG_ACTIONS: Record<LogAction, { label: string; icon: IconName; tone: Tone; category: LogCategory }> = {
  resolve_court_reports: { label: 'Denúncias de campo resolvidas', icon: 'check', tone: 'ok', category: 'moderation' },
  resolve_post_reports: { label: 'Denúncias de publicação resolvidas', icon: 'check', tone: 'ok', category: 'moderation' },
  block_player: { label: 'Jogador bloqueado', icon: 'ban', tone: 'warn', category: 'moderation' },
  unblock_player: { label: 'Jogador desbloqueado', icon: 'undo', tone: 'ok', category: 'moderation' },
  create_venue: { label: 'Local criado', icon: 'plus', tone: 'lime', category: 'create' },
  create_court: { label: 'Campo criado', icon: 'plus', tone: 'lime', category: 'create' },
  add_court_photo: { label: 'Foto de campo adicionada', icon: 'camera', tone: 'lime', category: 'create' },
  create_post: { label: 'Publicação criada', icon: 'plus', tone: 'lime', category: 'create' },
  add_waitlist: { label: 'Email adicionado à lista de espera', icon: 'mail', tone: 'lime', category: 'create' },
  update_player: { label: 'Jogador editado', icon: 'pencil', tone: 'cobalt', category: 'update' },
  update_venue: { label: 'Local editado', icon: 'pencil', tone: 'cobalt', category: 'update' },
  verify_venue: { label: 'Local verificado à mão', icon: 'shield-check', tone: 'ok', category: 'update' },
  update_court: { label: 'Campo editado', icon: 'pencil', tone: 'cobalt', category: 'update' },
  update_post: { label: 'Publicação editada', icon: 'pencil', tone: 'cobalt', category: 'update' },
  update_match: { label: 'Partida editada', icon: 'pencil', tone: 'cobalt', category: 'update' },
  cancel_match: { label: 'Partida cancelada', icon: 'close', tone: 'warn', category: 'update' },
  set_match_result: { label: 'Resultado corrigido', icon: 'pencil', tone: 'cobalt', category: 'update' },
  update_trip: { label: 'Viagem editada', icon: 'pencil', tone: 'cobalt', category: 'update' },
  delete_court: { label: 'Campo apagado', icon: 'trash', tone: 'danger', category: 'delete' },
  delete_venue: { label: 'Local apagado', icon: 'trash', tone: 'danger', category: 'delete' },
  delete_post: { label: 'Publicação apagada', icon: 'trash', tone: 'danger', category: 'delete' },
  delete_player: { label: 'Jogador apagado', icon: 'trash', tone: 'danger', category: 'delete' },
  delete_court_photo: { label: 'Foto de campo apagada', icon: 'trash', tone: 'danger', category: 'delete' },
  delete_match: { label: 'Partida apagada', icon: 'trash', tone: 'danger', category: 'delete' },
  delete_trip: { label: 'Viagem apagada', icon: 'trash', tone: 'danger', category: 'delete' },
  delete_waitlist: { label: 'Email removido da lista de espera', icon: 'trash', tone: 'danger', category: 'delete' }
};

export interface LogLine {
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
  reasons: string[];
}

function text(summary: Record<string, unknown>, key: string): string | null {
  const value = summary[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function count(summary: Record<string, unknown>, key: string): number {
  const value = summary[key];
  return typeof value === 'number' ? value : 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function join(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(' · ');
}

function quoted(value: string | null): string {
  return value ? `“${value}”` : '';
}

export function describeLog(entry: LogEntry): LogLine {
  const s = entry.summary;
  const meta = LOG_ACTIONS[entry.action] ?? { label: entry.action, icon: 'note', tone: 'neutral', category: 'update' };
  const base = { icon: meta.icon, tone: meta.tone, title: meta.label };
  const place = [text(s, 'city'), text(s, 'country')].filter(Boolean).join(', ');
  const rawReasons = Array.isArray(s['reasons']) ? (s['reasons'] as unknown[]).filter((r): r is string => typeof r === 'string') : [];
  const reasonLabels = entry.action.includes('post') ? POST_REASONS : COURT_REASONS;
  const reasons = [...new Set(rawReasons)].map(r => reasonLabels[r]?.label ?? r);
  const author = text(s, 'author_name') ?? 'conta apagada';
  const quote = text(s, 'text');
  const court = join(text(s, 'venue_name'), courtLabel(text(s, 'court_number')), place);
  const matchPlayers = [text(s, 'player_a_name'), text(s, 'player_b_name')].filter(Boolean).join(' vs ');
  const matchWhen = text(s, 'match_date') ? `${formatDay(text(s, 'match_date') ?? '')} ${formatTime(text(s, 'match_time'))}`.trim() : null;

  switch (entry.action) {
    case 'resolve_court_reports':
    case 'resolve_post_reports': {
      const what = entry.action === 'resolve_court_reports' ? 'de campo' : 'de publicação';
      const verb = s['resolution'] === 'dismissed' ? 'Ignorada' : 'Tratada';
      const n = count(s, 'reports');
      const title = n === 1 ? `${verb} 1 denúncia ${what}` : `${verb}s ${n} denúncias ${what}`;
      const detail = entry.action === 'resolve_court_reports' ? court : `De ${author}${quote ? ` — ${quoted(quote)}` : ''}`;
      return { icon: meta.icon, tone: s['resolution'] === 'dismissed' ? 'neutral' : 'ok', title, detail, reasons };
    }
    case 'delete_post':
    case 'create_post':
    case 'update_post':
      return {
        ...base,
        detail: `${entry.action === 'create_post' ? 'Em nome de' : 'De'} ${author}${quote ? ` — ${quoted(quote)}` : s['media_url'] ? ' — só com foto/vídeo' : ''}`,
        reasons
      };
    case 'delete_court':
      return { ...base, title: s['venue_deleted'] === true ? 'Campo e local apagados' : meta.label, detail: court, reasons };
    case 'delete_venue':
      return { ...base, detail: join(text(s, 'venue_name'), place, plural(count(s, 'courts'), 'campo', 'campos')), reasons };
    case 'create_venue':
    case 'update_venue':
    case 'verify_venue':
      return { ...base, detail: join(text(s, 'venue_name'), place), reasons };
    case 'create_court':
    case 'update_court':
    case 'add_court_photo':
    case 'delete_court_photo':
      return { ...base, detail: court, reasons };
    case 'update_player':
    case 'unblock_player':
      return { ...base, detail: join(text(s, 'name') ?? 'Jogador', text(s, 'email')), reasons };
    case 'block_player':
      return { ...base, detail: join(text(s, 'name') ?? 'Jogador', text(s, 'email'), quoted(text(s, 'reason'))), reasons };
    case 'delete_player':
      return {
        ...base,
        detail: join(text(s, 'name') ?? 'Jogador', text(s, 'email'), plural(count(s, 'posts'), 'publicação', 'publicações')),
        reasons
      };
    case 'update_match':
    case 'cancel_match':
    case 'delete_match':
      return { ...base, detail: join(matchPlayers, matchWhen, place), reasons };
    case 'set_match_result': {
      const sets = Array.isArray(s['sets']) ? formatSets(s['sets'] as [number, number][]) : '';
      return { ...base, detail: join(matchPlayers, sets || 'sem resultado', text(s, 'winner_name') && `venceu ${text(s, 'winner_name')}`), reasons };
    }
    case 'update_trip':
    case 'delete_trip':
      return { ...base, detail: join(text(s, 'player_name') ?? 'Conta apagada', place), reasons };
    case 'add_waitlist':
    case 'delete_waitlist':
      return { ...base, detail: text(s, 'email') ?? '', reasons };
  }
}
