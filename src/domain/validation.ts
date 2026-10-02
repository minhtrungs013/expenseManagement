import type { Account, Category, Transaction, TransactionInput } from './types';

/** An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const MAX_AMOUNT = 999_999_999_999_999;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateAmount(amount: number, label = 'Số tiền'): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError(`${label} phải lớn hơn 0`);
  if (amount > MAX_AMOUNT) throw new AppError(`${label} quá lớn`);
}

interface Lookup {
  accounts: Account[];
  categories: Category[];
  /** When editing: archived accounts/categories already used by this transaction stay valid. */
  original?: Transaction | null;
}

function checkAccount(id: number | null | undefined, { accounts, original }: Lookup, label: string): number {
  if (id == null) throw new AppError(`Vui lòng chọn ${label}`);
  const acc = accounts.find((a) => a.id === id);
  if (!acc) throw new AppError('Không tìm thấy tài khoản');
  const usedBefore = original != null && [original.accountId, original.fromAccountId, original.toAccountId].includes(id);
  if (!acc.isActive && !usedBefore) throw new AppError(`Tài khoản "${acc.name}" đã được lưu trữ`);
  return id;
}

/**
 * Validates a transaction and returns it in normalized shape
 * (fields that don't belong to the type are nulled out).
 */
export function normalizeTransaction(input: TransactionInput, lookup: Lookup): Required<TransactionInput> {
  validateAmount(input.amount);
  if (!DATE_RE.test(input.date)) throw new AppError('Ngày không hợp lệ');
  const note = (input.note ?? '').trim().slice(0, 200);

  if (input.type === 'transfer') {
    const fromAccountId = checkAccount(input.fromAccountId, lookup, 'tài khoản nguồn');
    const toAccountId = checkAccount(input.toAccountId, lookup, 'tài khoản đích');
    if (fromAccountId === toAccountId) throw new AppError('Không thể chuyển tiền vào cùng một tài khoản');
    return { type: 'transfer', amount: input.amount, accountId: null, categoryId: null, fromAccountId, toAccountId, note, date: input.date };
  }

  if (input.type !== 'income' && input.type !== 'expense') throw new AppError('Loại giao dịch không hợp lệ');

  const accountId = checkAccount(input.accountId, lookup, 'tài khoản');
  if (input.categoryId == null) throw new AppError('Vui lòng chọn danh mục');
  const cat = lookup.categories.find((c) => c.id === input.categoryId);
  if (!cat) throw new AppError('Không tìm thấy danh mục');
  if (cat.type !== input.type) throw new AppError('Danh mục không khớp với loại giao dịch');
  if (!cat.isActive && lookup.original?.categoryId !== cat.id) throw new AppError(`Danh mục "${cat.name}" đã được lưu trữ`);

  return {
    type: input.type,
    amount: input.amount,
    accountId,
    categoryId: cat.id,
    fromAccountId: null,
    toAccountId: null,
    note,
    date: input.date,
  };
}

export function validateName(name: string, label = 'Tên'): string {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(`${label} không được để trống`);
  if (trimmed.length > 50) throw new AppError(`${label} tối đa 50 ký tự`);
  return trimmed;
}

/** Accepts #RGB or #RRGGBB, returns #RRGGBB uppercase or null. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) return `#${s.split('').map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`.toUpperCase();
  return null;
}
