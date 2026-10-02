import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useToast } from '@/components/Toast';
import { loadSnapshot, type Snapshot } from '@/db/repo';
import { computeBalances } from '@/domain/calc';
import type { Account, Category, Money } from '@/domain/types';
import { AppError } from '@/domain/validation';

interface DataContextValue extends Snapshot {
  ready: boolean;
  balances: Map<number, Money>;
  accountById: Map<number, Account>;
  categoryById: Map<number, Category>;
  reload: () => Promise<void>;
  /**
   * Runs a database write, reloads data and shows feedback.
   * Returns true on success. Errors are shown as human-readable toasts.
   */
  mutate: (fn: (db: SQLiteDatabase) => Promise<void>, successMessage?: string) => Promise<boolean>;
}

const EMPTY: Snapshot = { accounts: [], categories: [], transactions: [], budgets: [] };
const DataContext = createContext<DataContextValue | null>(null);

export function errorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  console.warn(e);
  return 'Đã có lỗi xảy ra, vui lòng thử lại';
}

export function DataProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setSnapshot(await loadSnapshot(db));
    setReady(true);
  }, [db]);

  useEffect(() => {
    reload().catch((e) => toast(errorMessage(e), 'error'));
  }, [reload, toast]);

  const mutate = useCallback(
    async (fn: (db: SQLiteDatabase) => Promise<void>, successMessage?: string) => {
      try {
        await fn(db);
        await reload();
        if (successMessage) toast(successMessage);
        return true;
      } catch (e) {
        toast(errorMessage(e), 'error');
        return false;
      }
    },
    [db, reload, toast],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ...snapshot,
      ready,
      balances: computeBalances(snapshot.accounts, snapshot.transactions),
      accountById: new Map(snapshot.accounts.map((a) => [a.id, a])),
      categoryById: new Map(snapshot.categories.map((c) => [c.id, c])),
      reload,
      mutate,
    }),
    [snapshot, ready, reload, mutate],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
