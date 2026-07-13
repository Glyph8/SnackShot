import type { SQLiteDatabase } from 'expo-sqlite';

import { nowMs } from '@/lib/time';

// H4: 일봉 종가 캐시. (ticker,date) PK — 같은 종목·같은 날은 1행. soft delete 불필요(캐시).
// date는 'yyyy-MM-dd' 문자열(로컬 거래일).

export async function getCachedQuote(
  db: SQLiteDatabase,
  ticker: string,
  date: string,
): Promise<number | null> {
  const row = await db.getFirstAsync<{ close: number }>(
    'SELECT close FROM quotes WHERE ticker = ? AND date = ?',
    [ticker, date],
  );
  return row?.close ?? null;
}

export async function upsertQuote(
  db: SQLiteDatabase,
  ticker: string,
  date: string,
  close: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO quotes (ticker, date, close, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(ticker, date) DO UPDATE SET close = excluded.close, fetched_at = excluded.fetched_at`,
    [ticker, date, close, nowMs()],
  );
}
