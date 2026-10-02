import type { Category, Account, Money, Transaction, TxType, ISODate } from './types';

export type SortOrder = 'newest' | 'oldest' | 'highest' | 'lowest';

export interface TxFilter {
  search: string;
  type: TxType | 'all';
  accountId: number | null;
  categoryId: number | null;
  from: ISODate | null;
  to: ISODate | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  sort: SortOrder;
}

export const EMPTY_FILTER: TxFilter = {
  search: '',
  type: 'all',
  accountId: null,
  categoryId: null,
  from: null,
  to: null,
  minAmount: null,
  maxAmount: null,
  sort: 'newest',
};

/** Number of filters (excluding search and sort) that are active. */
export function activeFilterCount(f: TxFilter): number {
  return [f.type !== 'all', f.accountId != null, f.categoryId != null, f.from != null || f.to != null, f.minAmount != null || f.maxAmount != null].filter(Boolean).length;
}

/** Lowercase and strip Vietnamese diacritics so "an trua" matches "Ăn trưa". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function applyFilter(txs: Transaction[], f: TxFilter, categories: Category[], accounts: Account[]): Transaction[] {
  const q = fold(f.search.trim());
  const qDigits = f.search.replace(/[.,\s₫]/g, '');
  const catName = new Map(categories.map((c) => [c.id, fold(c.name)]));
  const accName = new Map(accounts.map((a) => [a.id, fold(a.name)]));

  const out = txs.filter((tx) => {
    if (f.type !== 'all' && tx.type !== f.type) return false;
    if (f.accountId != null && tx.accountId !== f.accountId && tx.fromAccountId !== f.accountId && tx.toAccountId !== f.accountId) return false;
    if (f.categoryId != null && tx.categoryId !== f.categoryId) return false;
    if (f.from && tx.date < f.from) return false;
    if (f.to && tx.date > f.to) return false;
    if (f.minAmount != null && tx.amount < f.minAmount) return false;
    if (f.maxAmount != null && tx.amount > f.maxAmount) return false;
    if (q) {
      const haystack = [
        fold(tx.note),
        tx.categoryId != null ? catName.get(tx.categoryId) : '',
        ...[tx.accountId, tx.fromAccountId, tx.toAccountId].map((id) => (id != null ? accName.get(id) : '')),
      ].join(' ');
      const amountMatch = /^\d+$/.test(qDigits) && String(tx.amount).startsWith(qDigits);
      if (!haystack.includes(q) && !amountMatch) return false;
    }
    return true;
  });

  const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date) || a.id - b.id;
  switch (f.sort) {
    case 'newest':
      return out.sort((a, b) => byDate(b, a));
    case 'oldest':
      return out.sort(byDate);
    case 'highest':
      return out.sort((a, b) => b.amount - a.amount || byDate(b, a));
    case 'lowest':
      return out.sort((a, b) => a.amount - b.amount || byDate(b, a));
  }
}
