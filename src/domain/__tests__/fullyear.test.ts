import { describe, expect, test } from '@jest/globals';

import { budgetProgress, computeBalances, expensesByCategory, summarize, totalBalance, trend } from '../calc';
import { monthRange } from '../dates';
import { generateDemoYear, type DemoRefs } from '../demo';
import { applyFilter, EMPTY_FILTER } from '../filter';
import type { Account, Category, Transaction } from '../types';
import { normalizeTransaction } from '../validation';

const NOW = '2026-10-02T00:00:00.000Z';
const END = '2026-10-02';
const YEAR = { from: '2025-10-03', to: END };

const accounts: Account[] = [
  { id: 1, name: 'Tiền mặt', type: 'cash', currency: 'VND', initialBalance: 1_000_000, isActive: true, createdAt: NOW, updatedAt: NOW },
  { id: 2, name: 'Vietcombank', type: 'bank', currency: 'VND', initialBalance: 20_000_000, isActive: true, createdAt: NOW, updatedAt: NOW },
  { id: 3, name: 'Momo', type: 'ewallet', currency: 'VND', initialBalance: 500_000, isActive: true, createdAt: NOW, updatedAt: NOW },
];

const expenseKeys = ['food', 'housing', 'transport', 'shopping', 'entertainment', 'health', 'education', 'bills', 'travel', 'family', 'other'] as const;
const incomeKeys = ['salary', 'freelance', 'bonus', 'gift'] as const;
const categories: Category[] = [
  ...expenseKeys.map((k, i) => ({ id: 10 + i, name: k, type: 'expense' as const, icon: '•', color: '#000000', isActive: true, createdAt: NOW, updatedAt: NOW })),
  ...incomeKeys.map((k, i) => ({ id: 30 + i, name: k, type: 'income' as const, icon: '•', color: '#000000', isActive: true, createdAt: NOW, updatedAt: NOW })),
];
const refs: DemoRefs = {
  accounts: { cash: 1, bank: 2, wallet: 3 },
  expense: Object.fromEntries(expenseKeys.map((k, i) => [k, 10 + i])) as DemoRefs['expense'],
  income: Object.fromEntries(incomeKeys.map((k, i) => [k, 30 + i])) as DemoRefs['income'],
};

/** Mirrors what the repository does: validate every input, then store it. */
function buildYear(): Transaction[] {
  return generateDemoYear(refs, END).map((input, idx) => ({
    id: idx + 1,
    currency: 'VND',
    createdAt: NOW,
    updatedAt: NOW,
    ...normalizeTransaction(input, { accounts, categories }),
  }));
}

const txs = buildYear();
const months = Array.from({ length: 13 }, (_, k) => {
  const d = new Date(2025, 9 + k, 1); // Oct 2025 … Oct 2026
  return monthRange(d.getFullYear(), d.getMonth());
});

describe('full year of data', () => {
  test('is realistic in size and every transaction passes validation', () => {
    expect(txs.length).toBeGreaterThan(1200);
    expect(txs.length).toBeLessThan(2500);
    expect(txs.every((t) => Number.isSafeInteger(t.amount) && t.amount > 0)).toBe(true);
    expect(txs.every((t) => t.date >= YEAR.from && t.date <= YEAR.to)).toBe(true);
    expect(new Set(txs.map((t) => t.type))).toEqual(new Set(['income', 'expense', 'transfer']));
  });

  test('is deterministic for the same seed', () => {
    expect(generateDemoYear(refs, END)).toEqual(generateDemoYear(refs, END));
  });

  test('total balance = initial balances + income − expense (transfers cancel out)', () => {
    const balances = computeBalances(accounts, txs);
    const initial = accounts.reduce((s, a) => s + a.initialBalance, 0);
    const year = summarize(txs, YEAR);
    expect(totalBalance(accounts, balances)).toBe(initial + year.income - year.expense);
  });

  test('each account balance matches a manual replay of its transactions', () => {
    const balances = computeBalances(accounts, txs);
    for (const acc of accounts) {
      let expected = acc.initialBalance;
      for (const t of txs) {
        if (t.type === 'income' && t.accountId === acc.id) expected += t.amount;
        if (t.type === 'expense' && t.accountId === acc.id) expected -= t.amount;
        if (t.type === 'transfer' && t.fromAccountId === acc.id) expected -= t.amount;
        if (t.type === 'transfer' && t.toAccountId === acc.id) expected += t.amount;
      }
      expect(balances.get(acc.id)).toBe(expected);
    }
  });

  test('sample data is realistic: no account ends the year overdrawn', () => {
    const balances = computeBalances(accounts, txs);
    for (const acc of accounts) expect(balances.get(acc.id)!).toBeGreaterThanOrEqual(0);
  });

  test('monthly summaries add up exactly to the yearly summary', () => {
    const year = summarize(txs, YEAR);
    const sum = months.reduce(
      (acc, m) => {
        const s = summarize(txs, { from: m.from < YEAR.from ? YEAR.from : m.from, to: m.to });
        return { income: acc.income + s.income, expense: acc.expense + s.expense };
      },
      { income: 0, expense: 0 },
    );
    expect(sum).toEqual({ income: year.income, expense: year.expense });
  });

  test('monthly trend matches monthly summaries', () => {
    const t = trend(txs, 'month', END, 12);
    for (const bucket of t) {
      const s = summarize(txs, bucket.range);
      expect([bucket.income, bucket.expense]).toEqual([s.income, s.expense]);
    }
  });

  test('expense by category sums to total expense', () => {
    const byCat = expensesByCategory(txs, YEAR);
    expect(byCat.reduce((s, c) => s + c.total, 0)).toBe(summarize(txs, YEAR).expense);
  });

  test('budget spent equals the filtered category total for every month', () => {
    const budget = { id: 1, categoryId: refs.expense.food, amount: 4_000_000, createdAt: NOW, updatedAt: NOW };
    for (const m of months) {
      const p = budgetProgress(budget, txs, m);
      const viaFilter = applyFilter(txs, { ...EMPTY_FILTER, type: 'expense', categoryId: refs.expense.food, from: m.from, to: m.to }, categories, accounts);
      expect(p.spent).toBe(viaFilter.reduce((s, t) => s + t.amount, 0));
    }
  });

  test('salary arrives every month and the person saves money over the year', () => {
    const salaries = txs.filter((t) => t.categoryId === refs.income.salary);
    expect(salaries.length).toBe(12);
    const year = summarize(txs, YEAR);
    expect(year.savingRate).not.toBeNull();
    expect(year.savingRate!).toBeGreaterThan(0);
    expect(year.savingRate!).toBeLessThan(60);
  });

  test('performance: all dashboard/report calculations on a year of data are fast', () => {
    const t0 = Date.now();
    for (let k = 0; k < 20; k++) {
      computeBalances(accounts, txs);
      summarize(txs, months[12]);
      expensesByCategory(txs, months[12]);
      trend(txs, 'month', END, 6);
      trend(txs, 'week', END, 8);
      applyFilter(txs, { ...EMPTY_FILTER, search: 'an trua' }, categories, accounts);
    }
    const perRender = (Date.now() - t0) / 20;
    // A screen recomputes these at most once per data change; keep it well under one frame budget × 3.
    expect(perRender).toBeLessThan(50);
  });

  test('performance: 10 years of data (≈ 17k transactions) stays usable', () => {
    const big: Transaction[] = [];
    for (let y = 0; y < 10; y++) {
      const end = `${2026 - y}-10-02`;
      generateDemoYear(refs, end, 365, 100 + y).forEach((input) => {
        big.push({ id: big.length + 1, currency: 'VND', createdAt: NOW, updatedAt: NOW, ...normalizeTransaction(input, { accounts, categories }) });
      });
    }
    const t0 = Date.now();
    computeBalances(accounts, big);
    summarize(big, months[12]);
    trend(big, 'year', END, 5);
    applyFilter(big, { ...EMPTY_FILTER, search: 'grab', sort: 'highest' }, categories, accounts);
    const ms = Date.now() - t0;
    expect(big.length).toBeGreaterThan(12_000);
    expect(ms).toBeLessThan(300);
  });
});
