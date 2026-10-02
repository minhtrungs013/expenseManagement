import type { SQLiteDatabase } from 'expo-sqlite';

import { atomic } from './atomic';

export const DATABASE_NAME = 'moneymate.db';

const DEFAULT_EXPENSE_CATEGORIES: [string, string, string][] = [
  ['Ăn uống', '🍜', '#F97316'],
  ['Nhà ở', '🏠', '#8B5CF6'],
  ['Di chuyển', '🛵', '#0EA5E9'],
  ['Mua sắm', '🛒', '#EC4899'],
  ['Giải trí', '🎬', '#F59E0B'],
  ['Sức khỏe', '💊', '#EF4444'],
  ['Giáo dục', '📚', '#6366F1'],
  ['Hóa đơn', '🧾', '#14B8A6'],
  ['Du lịch', '✈️', '#06B6D4'],
  ['Gia đình', '👨‍👩‍👧', '#84CC16'],
  ['Khác', '📦', '#64748B'],
];

const DEFAULT_INCOME_CATEGORIES: [string, string, string][] = [
  ['Lương', '💰', '#16A34A'],
  ['Freelance', '💻', '#0D9488'],
  ['Thưởng', '🎁', '#CA8A04'],
  ['Đầu tư', '📈', '#2563EB'],
  ['Quà tặng', '🎀', '#DB2777'],
  ['Khác', '📦', '#64748B'],
];

/** Creates or upgrades the schema. Bump user_version for every new migration. */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await atomic(db, async (txn) => {
      await txn.execAsync(`
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('cash','bank','ewallet','credit','investment','other')),
          currency TEXT NOT NULL DEFAULT 'VND',
          initial_balance INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('income','expense')),
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
          amount INTEGER NOT NULL CHECK (amount > 0),
          currency TEXT NOT NULL DEFAULT 'VND',
          account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
          category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
          from_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
          to_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
          note TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (
            (type IN ('income','expense') AND account_id IS NOT NULL AND category_id IS NOT NULL
               AND from_account_id IS NULL AND to_account_id IS NULL)
            OR
            (type = 'transfer' AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL
               AND from_account_id <> to_account_id AND account_id IS NULL AND category_id IS NULL)
          )
        );
        CREATE INDEX idx_tx_date ON transactions(date);
        CREATE INDEX idx_tx_account ON transactions(account_id);
        CREATE INDEX idx_tx_category ON transactions(category_id);
        CREATE INDEX idx_tx_from ON transactions(from_account_id);
        CREATE INDEX idx_tx_to ON transactions(to_account_id);
        CREATE TABLE budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL CHECK (amount > 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      await seedDefaults(txn);
    });
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${version}`);
}

export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();
  for (const [name, icon, color] of DEFAULT_EXPENSE_CATEGORIES) {
    await db.runAsync(
      'INSERT INTO categories (name, type, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      name, 'expense', icon, color, now, now,
    );
  }
  for (const [name, icon, color] of DEFAULT_INCOME_CATEGORIES) {
    await db.runAsync(
      'INSERT INTO categories (name, type, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      name, 'income', icon, color, now, now,
    );
  }
  await db.runAsync(
    'INSERT INTO accounts (name, type, initial_balance, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
    'Tiền mặt', 'cash', now, now,
  );
}
