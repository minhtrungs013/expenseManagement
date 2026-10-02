export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeSettings {
  mode: ThemeMode;
  primary: string;
  income: string;
  expense: string;
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  primary: '#4F46E5',
  income: '#16A34A',
  expense: '#DC2626',
};

export const PRIMARY_PRESETS = [
  '#4F46E5', '#2563EB', '#0891B2', '#0D9488', '#16A34A', '#65A30D',
  '#D97706', '#EA580C', '#DC2626', '#E11D48', '#DB2777', '#9333EA',
  '#7C3AED', '#334155', '#0F172A', '#78716C',
];

export const INCOME_PRESETS = ['#16A34A', '#059669', '#0D9488', '#2563EB', '#0891B2', '#65A30D'];
export const EXPENSE_PRESETS = ['#DC2626', '#E11D48', '#EA580C', '#D97706', '#9333EA', '#334155'];

export const CATEGORY_COLORS = [
  '#F97316', '#8B5CF6', '#0EA5E9', '#EC4899', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6',
  '#06B6D4', '#84CC16', '#64748B', '#16A34A', '#0D9488', '#CA8A04', '#2563EB', '#DB2777',
];

export interface Palette {
  dark: boolean;
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  /** primary adjusted to be readable as text on cards */
  link: string;
  income: string;
  expense: string;
  warning: string;
  transfer: string;
  overlay: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Blend `a` toward `b`. t=0 → a, t=1 → b */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as [number, number, number]);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#111827') ? '#FFFFFF' : '#111827';
}

/** Moves a color toward white (dark bg) or black (light bg) until it is readable as text on `bg`. */
function legibleOn(color: string, bg: string): string {
  const target = luminance(bg) < 0.5 ? '#FFFFFF' : '#000000';
  let c = color;
  for (let i = 0; i < 8 && contrast(c, bg) < 4; i++) c = mix(c, target, 0.2);
  return c;
}

export function buildPalette(s: ThemeSettings, dark: boolean): Palette {
  const bg = dark ? '#0B0D12' : '#F3F4F6';
  const card = dark ? '#161A22' : '#FFFFFF';
  return {
    dark,
    bg,
    card,
    cardAlt: dark ? '#1F2430' : '#F1F2F5',
    text: dark ? '#F3F4F6' : '#111827',
    textMuted: dark ? '#9CA3AF' : '#6B7280',
    border: dark ? '#2A303C' : '#E5E7EB',
    primary: s.primary,
    onPrimary: readableOn(s.primary),
    primarySoft: mix(s.primary, card, dark ? 0.75 : 0.88),
    link: legibleOn(s.primary, card),
    income: legibleOn(s.income, card),
    expense: legibleOn(s.expense, card),
    warning: '#F59E0B',
    transfer: dark ? '#93C5FD' : '#2563EB',
    overlay: 'rgba(0,0,0,0.45)',
  };
}
