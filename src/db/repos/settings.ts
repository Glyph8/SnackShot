import type { SQLiteDatabase } from 'expo-sqlite';

import { nowMs } from '@/lib/time';

interface SettingsRow {
  id: number;
  day_boundary_hour: number;
  updated_at: number;
}

export interface Settings {
  dayBoundaryHour: number;
}

// settings 테이블은 id=1인 싱글톤 row (마이그레이션 시 INSERT 됨)
export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('[settings] singleton row missing — migration may have failed');
  return { dayBoundaryHour: row.day_boundary_hour };
}

export async function setDayBoundaryHour(db: SQLiteDatabase, hour: number): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET day_boundary_hour = ?, updated_at = ? WHERE id = 1',
    [hour, nowMs()],
  );
}
