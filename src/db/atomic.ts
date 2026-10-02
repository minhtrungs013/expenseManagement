import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * Runs `fn` inside one database transaction: either every write succeeds or none do.
 * On phones this is an exclusive transaction (no other writes can interleave).
 * The browser preview only supports regular transactions.
 */
export async function atomic(db: SQLiteDatabase, fn: (txn: SQLiteDatabase) => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => fn(db));
  } else {
    await db.withExclusiveTransactionAsync(fn);
  }
}
