import { fromISODate, inRange, monthRange, toISODate } from './dates';
import type { Account, Budget, DateRange, ISODate, Money, Transaction } from './types';

/**
 * Balance of every account = initial balance + effect of all its transactions.
 * This is the single source of truth for balance math; balances are never stored.
 */
export function computeBalances(accounts: Account[], txs: Transaction[]): Map<number, Money> {
  const balances = new Map<number, Money>();
  for (const a of accounts) balances.set(a.id, a.initialBalance);
  const add = (id: number | null, delta: Money) => {
    if (id != null && balances.has(id)) balances.set(id, balances.get(id)! + delta);
  };
  for (const tx of txs) {
    if (tx.type === 'income') add(tx.accountId, tx.amount);
    else if (tx.type === 'expense') add(tx.accountId, -tx.amount);
    else {
      add(tx.fromAccountId, -tx.amount);
      add(tx.toAccountId, tx.amount);
    }
  }
  return balances;
}

/** Total balance counts active accounts only (archived ones are kept for history). */
export function totalBalance(accounts: Account[], balances: Map<number, Money>): Money {
  return accounts.filter((a) => a.isActive).reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
}

export interface PeriodSummary {
  income: Money;
  expense: Money;
  net: Money;
  /** null when there is no income in the period */
  savingRate: number | null;
}

/** Income and expense for a period. Transfers are never counted. */
export function summarize(txs: Transaction[], range: DateRange): PeriodSummary {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (!inRange(tx.date, range)) continue;
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expense += tx.amount;
  }
  const net = income - expense;
  return { income, expense, net, savingRate: savingRate(income, expense) };
}

export function savingRate(income: Money, expense: Money): number | null {
  if (income <= 0) return null;
  return ((income - expense) / income) * 100;
}

export function expensesByCategory(txs: Transaction[], range: DateRange): { categoryId: number; total: Money }[] {
  const totals = new Map<number, Money>();
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.categoryId == null || !inRange(tx.date, range)) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return [...totals.entries()].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total);
}

// ---------- Budgets ----------

export type BudgetStatus = 'normal' | 'warning' | 'exceeded';

export const BUDGET_WARNING_RATIO = 0.8;

/** < 80% normal, 80–99% warning, ≥ 100% exceeded */
export function budgetStatus(spent: Money, limit: Money): BudgetStatus {
  if (limit <= 0) return spent > 0 ? 'exceeded' : 'normal';
  const ratio = spent / limit;
  if (ratio >= 1) return 'exceeded';
  if (ratio >= BUDGET_WARNING_RATIO) return 'warning';
  return 'normal';
}

export interface BudgetProgress {
  budget: Budget;
  spent: Money;
  remaining: Money;
  /** 0–100+, can exceed 100 */
  percent: number;
  status: BudgetStatus;
}

/** Spent = sum of expense transactions in the budget's category within the range. */
export function budgetProgress(budget: Budget, txs: Transaction[], range: DateRange): BudgetProgress {
  let spent = 0;
  for (const tx of txs) {
    if (tx.type === 'expense' && tx.categoryId === budget.categoryId && inRange(tx.date, range)) spent += tx.amount;
  }
  const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  return {
    budget,
    spent,
    remaining: budget.amount - spent,
    percent,
    status: budgetStatus(spent, budget.amount),
  };
}

// ---------- Trend ----------

export type Granularity = 'week' | 'month' | 'year';

export interface TrendBucket {
  label: string;
  range: DateRange;
  income: Money;
  expense: Money;
}

function bucketRanges(granularity: Granularity, anchor: ISODate, count: number): { label: string; range: DateRange }[] {
  const a = fromISODate(anchor);
  const out: { label: string; range: DateRange }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    if (granularity === 'month') {
      const d = new Date(a.getFullYear(), a.getMonth() - i, 1);
      out.push({ label: `T${d.getMonth() + 1}`, range: monthRange(d.getFullYear(), d.getMonth()) });
    } else if (granularity === 'year') {
      const y = a.getFullYear() - i;
      out.push({ label: String(y), range: { from: `${y}-01-01`, to: `${y}-12-31` } });
    } else {
      // Weeks start on Monday.
      const monday = new Date(a);
      monday.setDate(a.getDate() - ((a.getDay() + 6) % 7) - i * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      out.push({
        label: `${monday.getDate()}/${monday.getMonth() + 1}`,
        range: { from: toISODate(monday), to: toISODate(sunday) },
      });
    }
  }
  return out;
}

export function trend(txs: Transaction[], granularity: Granularity, anchor: ISODate, count: number): TrendBucket[] {
  return bucketRanges(granularity, anchor, count).map(({ label, range }) => {
    const s = summarize(txs, range);
    return { label, range, income: s.income, expense: s.expense };
  });
}
