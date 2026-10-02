import type { DateRange, ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): ISODate {
  return toISODate(new Date());
}

/** month is 0-based like Date#getMonth */
export function monthRange(year: number, month: number): DateRange {
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}

export function currentMonthRange(): DateRange {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth());
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function inRange(date: ISODate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

/** "02/10/2026" */
export function formatDate(s: ISODate): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** "Thứ 6, 02/10/2026" */
export function formatLongDate(s: ISODate): string {
  return `${WEEKDAYS[fromISODate(s).getDay()]}, ${formatDate(s)}`;
}

/** "Hôm nay", "Hôm qua", or "Thứ 6, 02/10/2026" */
export function formatDayHeader(s: ISODate, now: ISODate = today()): string {
  if (s === now) return 'Hôm nay';
  const y = new Date(fromISODate(now));
  y.setDate(y.getDate() - 1);
  if (s === toISODate(y)) return 'Hôm qua';
  return formatLongDate(s);
}

export function formatMonth(year: number, month: number): string {
  return `Tháng ${month + 1}/${year}`;
}
