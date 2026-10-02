export type TxType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit' | 'investment' | 'other';

/** All money amounts are integers in the currency's minor unit (VND has none, so 1 = 1 ₫). */
export type Money = number;

/** Calendar dates are stored as local `YYYY-MM-DD` strings. */
export type ISODate = string;

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: Money;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  type: TxType;
  amount: Money;
  currency: string;
  /** income/expense only */
  accountId: number | null;
  /** income/expense only */
  categoryId: number | null;
  /** transfer only */
  fromAccountId: number | null;
  /** transfer only */
  toAccountId: number | null;
  note: string;
  date: ISODate;
  createdAt: string;
  updatedAt: string;
}

/** A monthly spending limit for one expense category. */
export interface Budget {
  id: number;
  categoryId: number;
  amount: Money;
  createdAt: string;
  updatedAt: string;
}

export type TransactionInput = {
  type: TxType;
  amount: Money;
  accountId?: number | null;
  categoryId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  note?: string;
  date: ISODate;
};

export interface DateRange {
  from: ISODate;
  to: ISODate;
}
