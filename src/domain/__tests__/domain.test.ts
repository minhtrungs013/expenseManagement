import { describe, expect, test } from '@jest/globals';

import { budgetProgress, budgetStatus, computeBalances, expensesByCategory, savingRate, summarize, totalBalance, trend } from '../calc';
import { applyFilter, EMPTY_FILTER } from '../filter';
import { formatCompact, formatMoney, formatSigned, parseAmount } from '../money';
import type { Account, Budget, Category, Transaction } from '../types';
import { AppError, normalizeHex, normalizeTransaction } from '../validation';

const NOW = '2026-10-02T00:00:00.000Z';

function account(id: number, initialBalance: number, isActive = true): Account {
  return { id, name: `Acc ${id}`, type: 'bank', currency: 'VND', initialBalance, isActive, createdAt: NOW, updatedAt: NOW };
}

function category(id: number, type: 'income' | 'expense', name = `Cat ${id}`, isActive = true): Category {
  return { id, name, type, icon: '•', color: '#000000', isActive, createdAt: NOW, updatedAt: NOW };
}

let nextId = 1;
function tx(p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  return {
    id: nextId++,
    currency: 'VND',
    accountId: null,
    categoryId: null,
    fromAccountId: null,
    toAccountId: null,
    note: '',
    date: '2026-10-02',
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

const OCT = { from: '2026-10-01', to: '2026-10-31' };

describe('balances', () => {
  test('expense decreases balance', () => {
    const b = computeBalances([account(1, 1_000_000)], [tx({ type: 'expense', amount: 200_000, accountId: 1, categoryId: 10 })]);
    expect(b.get(1)).toBe(800_000);
  });

  test('income increases balance', () => {
    const b = computeBalances([account(1, 1_000_000)], [tx({ type: 'income', amount: 500_000, accountId: 1, categoryId: 20 })]);
    expect(b.get(1)).toBe(1_500_000);
  });

  test('transfer moves money and keeps the total', () => {
    const accounts = [account(1, 1_000_000), account(2, 500_000)];
    const b = computeBalances(accounts, [tx({ type: 'transfer', amount: 200_000, fromAccountId: 1, toAccountId: 2 })]);
    expect(b.get(1)).toBe(800_000);
    expect(b.get(2)).toBe(700_000);
    expect(totalBalance(accounts, b)).toBe(1_500_000);
  });

  test('archived accounts are excluded from the total', () => {
    const accounts = [account(1, 1_000_000), account(2, 500_000, false)];
    expect(totalBalance(accounts, computeBalances(accounts, []))).toBe(1_000_000);
  });
});

describe('summary', () => {
  const txs = [
    tx({ type: 'income', amount: 15_000_000, accountId: 1, categoryId: 20 }),
    tx({ type: 'expense', amount: 7_250_000, accountId: 1, categoryId: 10 }),
    tx({ type: 'transfer', amount: 500_000, fromAccountId: 1, toAccountId: 2 }),
    tx({ type: 'expense', amount: 999, accountId: 1, categoryId: 10, date: '2026-09-30' }),
  ];

  test('transfers do not count as income or expense; other months excluded', () => {
    const s = summarize(txs, OCT);
    expect(s.income).toBe(15_000_000);
    expect(s.expense).toBe(7_250_000);
    expect(s.net).toBe(7_750_000);
    expect(s.savingRate).toBeCloseTo(51.67, 2);
  });

  test('saving rate is null without income', () => {
    expect(savingRate(0, 100)).toBeNull();
  });

  test('expenses by category sorted desc and ignore transfers', () => {
    const r = expensesByCategory(
      [
        tx({ type: 'expense', amount: 100, accountId: 1, categoryId: 1 }),
        tx({ type: 'expense', amount: 300, accountId: 1, categoryId: 2 }),
        tx({ type: 'expense', amount: 50, accountId: 1, categoryId: 1 }),
        tx({ type: 'transfer', amount: 9999, fromAccountId: 1, toAccountId: 2 }),
      ],
      OCT,
    );
    expect(r).toEqual([
      { categoryId: 2, total: 300 },
      { categoryId: 1, total: 150 },
    ]);
  });

  test('monthly trend buckets', () => {
    const t = trend(txs, 'month', '2026-10-02', 2);
    expect(t.map((b) => b.label)).toEqual(['T9', 'T10']);
    expect(t[0].expense).toBe(999);
    expect(t[1].income).toBe(15_000_000);
  });

  test('weekly trend starts on Monday', () => {
    const t = trend([], 'week', '2026-10-02', 1); // Friday
    expect(t[0].range).toEqual({ from: '2026-09-28', to: '2026-10-04' });
  });
});

describe('budgets', () => {
  const budget: Budget = { id: 1, categoryId: 10, amount: 1_000_000, createdAt: NOW, updatedAt: NOW };

  test('80% is warning', () => {
    const p = budgetProgress(budget, [tx({ type: 'expense', amount: 800_000, accountId: 1, categoryId: 10 })], OCT);
    expect(p.percent).toBe(80);
    expect(p.status).toBe('warning');
    expect(p.remaining).toBe(200_000);
  });

  test('status thresholds', () => {
    expect(budgetStatus(790_000, 1_000_000)).toBe('normal');
    expect(budgetStatus(990_000, 1_000_000)).toBe('warning');
    expect(budgetStatus(1_000_000, 1_000_000)).toBe('exceeded');
    expect(budgetStatus(1_500_000, 1_000_000)).toBe('exceeded');
  });

  test('income, transfers, other categories and other months are not counted', () => {
    const p = budgetProgress(
      budget,
      [
        tx({ type: 'income', amount: 1, accountId: 1, categoryId: 10 }),
        tx({ type: 'transfer', amount: 2, fromAccountId: 1, toAccountId: 2 }),
        tx({ type: 'expense', amount: 4, accountId: 1, categoryId: 11 }),
        tx({ type: 'expense', amount: 8, accountId: 1, categoryId: 10, date: '2026-11-01' }),
        tx({ type: 'expense', amount: 16, accountId: 1, categoryId: 10 }),
      ],
      OCT,
    );
    expect(p.spent).toBe(16);
  });
});

describe('transaction validation', () => {
  const lookup = {
    accounts: [account(1, 0), account(2, 0), account(3, 0, false)],
    categories: [category(10, 'expense'), category(20, 'income'), category(30, 'expense', 'Old', false)],
  };
  const base = { amount: 50_000, date: '2026-10-02' };

  test('rejects non-positive and non-integer amounts', () => {
    for (const amount of [0, -1, 1.5, NaN]) {
      expect(() => normalizeTransaction({ ...base, amount, type: 'expense', accountId: 1, categoryId: 10 }, lookup)).toThrow(AppError);
    }
  });

  test('expense requires account and matching category', () => {
    expect(() => normalizeTransaction({ ...base, type: 'expense', categoryId: 10 }, lookup)).toThrow('tài khoản');
    expect(() => normalizeTransaction({ ...base, type: 'expense', accountId: 1 }, lookup)).toThrow('danh mục');
    expect(() => normalizeTransaction({ ...base, type: 'expense', accountId: 1, categoryId: 20 }, lookup)).toThrow('không khớp');
  });

  test('transfer clears category/account and rejects same account', () => {
    const t = normalizeTransaction({ ...base, type: 'transfer', fromAccountId: 1, toAccountId: 2, categoryId: 10, accountId: 1 }, lookup);
    expect(t.categoryId).toBeNull();
    expect(t.accountId).toBeNull();
    expect(() => normalizeTransaction({ ...base, type: 'transfer', fromAccountId: 1, toAccountId: 1 }, lookup)).toThrow('cùng một tài khoản');
  });

  test('income/expense clear transfer fields', () => {
    const t = normalizeTransaction({ ...base, type: 'income', accountId: 1, categoryId: 20, fromAccountId: 1, toAccountId: 2 }, lookup);
    expect(t.fromAccountId).toBeNull();
    expect(t.toAccountId).toBeNull();
  });

  test('archived account/category rejected for new, allowed when unchanged on edit', () => {
    const input = { ...base, type: 'expense' as const, accountId: 3, categoryId: 30 };
    expect(() => normalizeTransaction(input, lookup)).toThrow('lưu trữ');
    const original = tx({ type: 'expense', amount: 1, accountId: 3, categoryId: 30 });
    expect(normalizeTransaction(input, { ...lookup, original }).accountId).toBe(3);
  });

  test('unknown account', () => {
    expect(() => normalizeTransaction({ ...base, type: 'expense', accountId: 99, categoryId: 10 }, lookup)).toThrow('Không tìm thấy tài khoản');
  });
});

describe('money formatting', () => {
  test('VND format', () => {
    expect(formatMoney(15_000_000)).toBe('15.000.000 ₫');
    expect(formatMoney(0)).toBe('0 ₫');
    expect(formatSigned(-50_000)).toBe('-50.000 ₫');
    expect(formatSigned(500)).toBe('+500 ₫');
  });

  test('compact', () => {
    expect(formatCompact(2_100_000)).toBe('2.1M');
    expect(formatCompact(850_000)).toBe('850K');
    expect(formatCompact(1_500_000_000)).toBe('1.5B');
  });

  test('parseAmount keeps digits only', () => {
    expect(parseAmount('1.500.000')).toBe(1_500_000);
    expect(parseAmount('abc')).toBe(0);
  });

  test('normalizeHex', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('10b981')).toBe('#10B981');
    expect(normalizeHex('#12345')).toBeNull();
  });
});

describe('search & filter', () => {
  const cats = [category(10, 'expense', 'Ăn uống'), category(20, 'income', 'Lương')];
  const accs = [account(1, 0)];
  const txs = [
    tx({ type: 'expense', amount: 50_000, accountId: 1, categoryId: 10, note: 'Ăn trưa', date: '2026-10-01' }),
    tx({ type: 'expense', amount: 72_000, accountId: 1, categoryId: 10, note: 'Grab', date: '2026-10-02' }),
    tx({ type: 'income', amount: 15_000_000, accountId: 1, categoryId: 20, date: '2026-09-25' }),
  ];

  test('search ignores accents and matches category names and amounts', () => {
    expect(applyFilter(txs, { ...EMPTY_FILTER, search: 'an trua' }, cats, accs)).toHaveLength(1);
    expect(applyFilter(txs, { ...EMPTY_FILTER, search: 'luong' }, cats, accs)).toHaveLength(1);
    expect(applyFilter(txs, { ...EMPTY_FILTER, search: '50.000' }, cats, accs)).toHaveLength(1);
    expect(applyFilter(txs, { ...EMPTY_FILTER, search: 'grab' }, cats, accs)[0].amount).toBe(72_000);
  });

  test('filters and sorting', () => {
    expect(applyFilter(txs, { ...EMPTY_FILTER, type: 'income' }, cats, accs)).toHaveLength(1);
    expect(applyFilter(txs, { ...EMPTY_FILTER, minAmount: 60_000, maxAmount: 100_000 }, cats, accs)).toHaveLength(1);
    expect(applyFilter(txs, { ...EMPTY_FILTER, from: '2026-10-01', to: '2026-10-31' }, cats, accs)).toHaveLength(2);
    expect(applyFilter(txs, { ...EMPTY_FILTER, sort: 'highest' }, cats, accs)[0].amount).toBe(15_000_000);
    expect(applyFilter(txs, { ...EMPTY_FILTER, sort: 'oldest' }, cats, accs)[0].date).toBe('2026-09-25');
  });
});
