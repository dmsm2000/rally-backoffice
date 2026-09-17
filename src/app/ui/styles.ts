// Shared class strings: the same few controls repeat on every page.

const BUTTON =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40';

export const BTN_GHOST = `${BUTTON} border border-line hover:bg-raised`;
export const BTN_PRIMARY = `${BUTTON} bg-lime font-bold text-bg hover:bg-lime/85`;
export const BTN_OK = `${BUTTON} border border-ok/40 text-ok hover:bg-ok/12`;
export const BTN_DANGER = `${BUTTON} border border-danger/40 text-danger hover:bg-danger/12`;
export const BTN_WARN = `${BUTTON} bg-warn font-bold text-bg hover:bg-warn/85`;
export const BTN_LINK = 'inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg';

export const PILL = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap';

export const CARD = 'rounded-2xl border border-line bg-surface';

export const SEGMENTED = 'inline-flex rounded-lg border border-line bg-surface p-1';
export const SEGMENT = 'cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold transition-colors';
export const SEGMENT_ACTIVE = 'bg-raised text-fg';
export const SEGMENT_IDLE = 'text-muted hover:text-fg';

export const INPUT =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-lime disabled:opacity-50';
export const LABEL = 'eyebrow text-muted';
export const CHIP = 'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors';
export const CHIP_ACTIVE = 'border-fg bg-fg text-bg';
export const CHIP_IDLE = 'border-line text-muted hover:border-fg/40 hover:text-fg';
