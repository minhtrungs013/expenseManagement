import type { SQLiteDatabase } from 'expo-sqlite';

import { toISODate } from '@/domain/dates';
import { DEMO_BUDGETS, DEMO_CATEGORY_NAMES, generateDemoYear, type DemoRefs } from '@/domain/demo';
import type { Account, AccountType, Budget, Category, CategoryType, Money, Transaction, TransactionInput } from '@/domain/types';
import { AppError, normalizeHex, normalizeTransaction, validateAmount, validateName } from '@/domain/validation';

import { atomic } from './atomic';

// ---------- Row mapping ----------

interface AccountRow {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}
interface CategoryRow {
  id: number;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}
interface TransactionRow {
  id: number;
  type: Transaction['type'];
  amount: number;
  currency: string;
  account_id: number | null;
  category_id: number | null;
  from_account_id: number | null;
  to_account_id: number | null;
  note: string;
  date: string;
  created_at: string;
  updated_at: string;
}
interface BudgetRow {
  id: number;
  category_id: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  name: r.name,
  type: r.type,
  currency: r.currency,
  initialBalance: r.initial_balance,
  isActive: r.is_active === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  type: r.type,
  icon: r.icon,
  color: r.color,
  isActive: r.is_active === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  type: r.type,
  amount: r.amount,
  currency: r.currency,
  accountId: r.account_id,
  categoryId: r.category_id,
  fromAccountId: r.from_account_id,
  toAccountId: r.to_account_id,
  note: r.note,
  date: r.date,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toBudget = (r: BudgetRow): Budget => ({
  id: r.id,
  categoryId: r.category_id,
  amount: r.amount,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const nowIso = () => new Date().toISOString();

// ---------- Reads ----------

export interface Snapshot {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

export async function loadAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return (await db.getAllAsync<AccountRow>('SELECT * FROM accounts ORDER BY is_active DESC, id')).map(toAccount);
}
export async function loadCategories(db: SQLiteDatabase): Promise<Category[]> {
  return (await db.getAllAsync<CategoryRow>('SELECT * FROM categories ORDER BY type, is_active DESC, id')).map(toCategory);
}

export async function loadSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const [accounts, categories, transactions, budgets] = await Promise.all([
    loadAccounts(db),
    loadCategories(db),
    db.getAllAsync<TransactionRow>('SELECT * FROM transactions ORDER BY date DESC, id DESC').then((r) => r.map(toTransaction)),
    db.getAllAsync<BudgetRow>('SELECT * FROM budgets ORDER BY id').then((r) => r.map(toBudget)),
  ]);
  return { accounts, categories, transactions, budgets };
}

// ---------- Accounts ----------

export interface AccountInput {
  name: string;
  type: AccountType;
  initialBalance: Money;
}

const ACCOUNT_TYPES: AccountType[] = ['cash', 'bank', 'ewallet', 'credit', 'investment', 'other'];

function checkAccountInput(input: AccountInput): AccountInput {
  if (!ACCOUNT_TYPES.includes(input.type)) throw new AppError('Loại tài khoản không hợp lệ');
  // Initial balance may be negative (e.g. credit card debt) but must be an integer.
  if (!Number.isSafeInteger(input.initialBalance)) throw new AppError('Số dư ban đầu không hợp lệ');
  return { ...input, name: validateName(input.name, 'Tên tài khoản') };
}

export async function saveAccount(db: SQLiteDatabase, raw: AccountInput, id?: number): Promise<void> {
  const input = checkAccountInput(raw);
  const now = nowIso();
  if (id == null) {
    await db.runAsync(
      'INSERT INTO accounts (name, type, initial_balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      input.name, input.type, input.initialBalance, now, now,
    );
  } else {
    const r = await db.runAsync(
      'UPDATE accounts SET name = ?, type = ?, initial_balance = ?, updated_at = ? WHERE id = ?',
      input.name, input.type, input.initialBalance, now, id,
    );
    if (r.changes === 0) throw new AppError('Không tìm thấy tài khoản');
  }
}

export async function setAccountActive(db: SQLiteDatabase, id: number, active: boolean): Promise<void> {
  await db.runAsync('UPDATE accounts SET is_active = ?, updated_at = ? WHERE id = ?', active ? 1 : 0, nowIso(), id);
}

export async function countAccountTransactions(db: SQLiteDatabase, id: number): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? OR from_account_id = ? OR to_account_id = ?',
    id, id, id,
  );
  return r?.n ?? 0;
}

/** Only accounts without any transaction can be deleted; others must be archived. */
export async function deleteAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await atomic(db, async (txn) => {
    if ((await countAccountTransactions(txn, id)) > 0) {
      throw new AppError('Tài khoản đã có giao dịch, hãy lưu trữ thay vì xoá');
    }
    await txn.runAsync('DELETE FROM accounts WHERE id = ?', id);
  });
}

// ---------- Categories ----------

export interface CategoryInput {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

function checkCategoryInput(input: CategoryInput): CategoryInput {
  if (input.type !== 'income' && input.type !== 'expense') throw new AppError('Loại danh mục không hợp lệ');
  const color = normalizeHex(input.color);
  if (!color) throw new AppError('Màu không hợp lệ');
  const icon = input.icon.trim() || '📦';
  return { name: validateName(input.name, 'Tên danh mục'), type: input.type, icon, color };
}

export async function saveCategory(db: SQLiteDatabase, raw: CategoryInput, id?: number): Promise<void> {
  const input = checkCategoryInput(raw);
  const now = nowIso();
  if (id == null) {
    await db.runAsync(
      'INSERT INTO categories (name, type, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      input.name, input.type, input.icon, input.color, now, now,
    );
    return;
  }
  await atomic(db, async (txn) => {
    const existing = await txn.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id);
    if (!existing) throw new AppError('Không tìm thấy danh mục');
    // Changing type would break the meaning of existing transactions.
    const used = await txn.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?', id);
    if (existing.type !== input.type && (used?.n ?? 0) > 0) {
      throw new AppError('Không thể đổi loại của danh mục đã có giao dịch');
    }
    await txn.runAsync(
      'UPDATE categories SET name = ?, type = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?',
      input.name, input.type, input.icon, input.color, nowIso(), id,
    );
    if (input.type !== 'expense') await txn.runAsync('DELETE FROM budgets WHERE category_id = ?', id);
  });
}

export async function setCategoryActive(db: SQLiteDatabase, id: number, active: boolean): Promise<void> {
  await db.runAsync('UPDATE categories SET is_active = ?, updated_at = ? WHERE id = ?', active ? 1 : 0, nowIso(), id);
}

export async function deleteCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await atomic(db, async (txn) => {
    const used = await txn.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?', id);
    if ((used?.n ?? 0) > 0) throw new AppError('Danh mục đã có giao dịch, hãy lưu trữ thay vì xoá');
    await txn.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
}

// ---------- Transactions ----------

/**
 * Creates or updates a transaction. Validation reads the current accounts and categories
 * inside the same exclusive DB transaction, so the write is atomic and never trusts the UI.
 */
export async function saveTransaction(db: SQLiteDatabase, input: TransactionInput, id?: number): Promise<void> {
  await atomic(db, async (txn) => {
    const accounts = await loadAccounts(txn);
    const categories = await loadCategories(txn);
    let original: Transaction | null = null;
    if (id != null) {
      const row = await txn.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', id);
      if (!row) throw new AppError('Không tìm thấy giao dịch');
      original = toTransaction(row);
    }
    const t = normalizeTransaction(input, { accounts, categories, original });
    const now = nowIso();
    if (original == null) {
      await txn.runAsync(
        `INSERT INTO transactions (type, amount, account_id, category_id, from_account_id, to_account_id, note, date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.type, t.amount, t.accountId, t.categoryId, t.fromAccountId, t.toAccountId, t.note, t.date, now, now,
      );
    } else {
      await txn.runAsync(
        `UPDATE transactions SET type = ?, amount = ?, account_id = ?, category_id = ?, from_account_id = ?, to_account_id = ?,
         note = ?, date = ?, updated_at = ? WHERE id = ?`,
        t.type, t.amount, t.accountId, t.categoryId, t.fromAccountId, t.toAccountId, t.note, t.date, now, original.id,
      );
    }
  });
}

export async function deleteTransaction(db: SQLiteDatabase, id: number): Promise<void> {
  const r = await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
  if (r.changes === 0) throw new AppError('Không tìm thấy giao dịch');
}

// ---------- Budgets ----------

export async function saveBudget(db: SQLiteDatabase, input: { categoryId: number; amount: Money }, id?: number): Promise<void> {
  validateAmount(input.amount, 'Hạn mức');
  await atomic(db, async (txn) => {
    const cat = await txn.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', input.categoryId);
    if (!cat) throw new AppError('Không tìm thấy danh mục');
    if (cat.type !== 'expense') throw new AppError('Ngân sách chỉ áp dụng cho danh mục chi tiêu');
    const dup = await txn.getFirstAsync<BudgetRow>('SELECT * FROM budgets WHERE category_id = ? AND id IS NOT ?', input.categoryId, id ?? null);
    if (dup) throw new AppError(`Danh mục "${cat.name}" đã có ngân sách`);
    const now = nowIso();
    if (id == null) {
      await txn.runAsync('INSERT INTO budgets (category_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?)', input.categoryId, input.amount, now, now);
    } else {
      const r = await txn.runAsync('UPDATE budgets SET category_id = ?, amount = ?, updated_at = ? WHERE id = ?', input.categoryId, input.amount, now, id);
      if (r.changes === 0) throw new AppError('Không tìm thấy ngân sách');
    }
  });
}

export async function deleteBudget(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}

// ---------- Settings ----------

export async function loadSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

// ---------- Backup ----------

export const BACKUP_FORMAT = 'moneymate-backup';

export interface Backup extends Snapshot {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  settings: Record<string, string>;
}

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const snapshot = await loadSnapshot(db);
  return { format: BACKUP_FORMAT, version: 1, exportedAt: nowIso(), ...snapshot, settings: await loadSettings(db) };
}

/** Replaces ALL data with the backup. Everything is validated first and written atomically. */
export async function importBackup(db: SQLiteDatabase, data: unknown): Promise<void> {
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || b.version !== 1) throw new AppError('File không phải bản sao lưu MoneyMate hợp lệ');
  if (![b.accounts, b.categories, b.transactions, b.budgets].every(Array.isArray)) throw new AppError('File sao lưu bị hỏng');
  const accounts = b.accounts!;
  const categories = b.categories!;
  const transactions = b.transactions!;
  const budgets = b.budgets!;

  try {
    accounts.forEach(checkAccountInput);
    categories.forEach(checkCategoryInput);
    transactions.forEach((t) => normalizeTransaction(t, { accounts, categories, original: t }));
    budgets.forEach((x) => validateAmount(x.amount, 'Hạn mức'));
  } catch (e) {
    throw new AppError(`File sao lưu chứa dữ liệu không hợp lệ: ${e instanceof Error ? e.message : ''}`);
  }

  await atomic(db, async (txn) => {
    await txn.execAsync('DELETE FROM budgets; DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts;');
    for (const a of accounts) {
      await txn.runAsync(
        'INSERT INTO accounts (id, name, type, currency, initial_balance, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        a.id, a.name, a.type, a.currency || 'VND', a.initialBalance, a.isActive ? 1 : 0, a.createdAt, a.updatedAt,
      );
    }
    for (const c of categories) {
      await txn.runAsync(
        'INSERT INTO categories (id, name, type, icon, color, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        c.id, c.name, c.type, c.icon, c.color, c.isActive ? 1 : 0, c.createdAt, c.updatedAt,
      );
    }
    for (const t of transactions) {
      await txn.runAsync(
        `INSERT INTO transactions (id, type, amount, currency, account_id, category_id, from_account_id, to_account_id, note, date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id, t.type, t.amount, t.currency || 'VND', t.accountId, t.categoryId, t.fromAccountId, t.toAccountId, t.note ?? '', t.date, t.createdAt, t.updatedAt,
      );
    }
    for (const x of budgets) {
      await txn.runAsync('INSERT INTO budgets (id, category_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', x.id, x.categoryId, x.amount, x.createdAt, x.updatedAt);
    }
    for (const [key, value] of Object.entries(b.settings ?? {})) {
      if (typeof value === 'string') await setSetting(txn, key, value);
    }
  });
}

/**
 * Adds a year of realistic sample transactions (plus Vietcombank/Momo accounts and a few budgets)
 * so the app can be tried with real-looking data. Existing data is kept. Returns how many were added.
 */
export async function seedDemoYear(db: SQLiteDatabase): Promise<number> {
  let added = 0;
  await atomic(db, async (txn) => {
    const now = nowIso();
    const ensureAccount = async (name: string, type: AccountType, initialBalance: Money) => {
      const row = await txn.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE name = ? AND is_active = 1', name);
      if (row) return row.id;
      const r = await txn.runAsync(
        'INSERT INTO accounts (name, type, initial_balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        name, type, initialBalance, now, now,
      );
      return r.lastInsertRowId;
    };
    const cashRow = await txn.getFirstAsync<{ id: number }>("SELECT id FROM accounts WHERE type = 'cash' AND is_active = 1 ORDER BY id");
    const accountIds = {
      cash: cashRow?.id ?? (await ensureAccount('Tiền mặt', 'cash', 1_000_000)),
      bank: await ensureAccount('Vietcombank', 'bank', 20_000_000),
      wallet: await ensureAccount('Momo', 'ewallet', 500_000),
    };

    const categories = await loadCategories(txn);
    const find = (type: CategoryType, name: string) => {
      const c = categories.find((x) => x.type === type && x.name === name && x.isActive);
      if (!c) throw new AppError(`Không tìm thấy danh mục mặc định "${name}"`);
      return c.id;
    };
    const mapIds = <K extends string>(type: CategoryType, names: Record<K, string>) =>
      Object.fromEntries(Object.entries<string>(names).map(([k, n]) => [k, find(type, n)])) as Record<K, number>;
    const refs: DemoRefs = {
      accounts: accountIds,
      expense: mapIds('expense', DEMO_CATEGORY_NAMES.expense),
      income: mapIds('income', DEMO_CATEGORY_NAMES.income),
    };

    const accounts = await loadAccounts(txn);
    const inputs = generateDemoYear(refs, toISODate(new Date()));
    const stmt = await txn.prepareAsync(
      `INSERT INTO transactions (type, amount, account_id, category_id, from_account_id, to_account_id, note, date, created_at, updated_at)
       VALUES ($type, $amount, $accountId, $categoryId, $fromAccountId, $toAccountId, $note, $date, $now, $now)`,
    );
    try {
      for (const input of inputs) {
        const t = normalizeTransaction(input, { accounts, categories });
        await stmt.executeAsync({
          $type: t.type, $amount: t.amount, $accountId: t.accountId, $categoryId: t.categoryId,
          $fromAccountId: t.fromAccountId, $toAccountId: t.toAccountId, $note: t.note, $date: t.date, $now: now,
        });
        added++;
      }
    } finally {
      await stmt.finalizeAsync();
    }

    for (const b of DEMO_BUDGETS) {
      await txn.runAsync(
        'INSERT OR IGNORE INTO budgets (category_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?)',
        refs.expense[b.key], b.amount, now, now,
      );
    }
  });
  return added;
}

/** Deletes every record and restores the default categories and cash account. */
export async function resetAllData(db: SQLiteDatabase, seed: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  await atomic(db, async (txn) => {
    await txn.execAsync('DELETE FROM budgets; DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts;');
    await seed(txn);
  });
}
