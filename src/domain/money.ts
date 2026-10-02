import type { Money } from './types';

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 15000000 → "15.000.000 ₫" */
export function formatMoney(amount: Money): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${groupThousands(Math.abs(Math.round(amount)))} ₫`;
}

/** Always shows a sign: "+15.000.000 ₫" / "-50.000 ₫" */
export function formatSigned(amount: Money): string {
  return amount > 0 ? `+${formatMoney(amount)}` : formatMoney(amount);
}

/** 2100000 → "2.1M", 850000 → "850K" */
export function formatCompact(amount: Money): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const trim = (v: number) => (v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}K`;
  return `${sign}${abs}`;
}

/** Turns whatever the user typed into an integer amount (digits only). */
export function parseAmount(text: string): Money {
  const digits = text.replace(/\D/g, '');
  if (!digits) return 0;
  // Cap at 15 digits so we stay inside Number.MAX_SAFE_INTEGER.
  return Number(digits.slice(0, 15));
}

/** Formats a partially typed amount for an input field: "1500000" → "1.500.000" */
export function formatAmountInput(amount: Money): string {
  return amount > 0 ? groupThousands(amount) : '';
}
