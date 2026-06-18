import type { SQLiteDatabase } from 'expo-sqlite';

import { nowMs } from '@/lib/time';

interface SettingsRow {
  id: number;
  day_boundary_hour: number;
  obsidian_vault_uri: string | null;
  obsidian_auto_export: number;
  custom_categories_json: string | null;
  updated_at: number;
}

export interface Settings {
  dayBoundaryHour: number;
  obsidianVaultUri: string | null;
  obsidianAutoExport: boolean;
  customCategories: string[];
}

function parseCustomCategories(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// settings 테이블은 id=1인 싱글톤 row (마이그레이션 시 INSERT 됨)
export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('[settings] singleton row missing — migration may have failed');
  return {
    dayBoundaryHour: row.day_boundary_hour,
    obsidianVaultUri: row.obsidian_vault_uri ?? null,
    obsidianAutoExport: row.obsidian_auto_export === 1,
    customCategories: parseCustomCategories(row.custom_categories_json),
  };
}

// 사용자 커스텀 카테고리 추가(중복 무시) — 갱신된 전체 목록 반환 (v9)
export async function addCustomCategory(db: SQLiteDatabase, label: string): Promise<string[]> {
  const current = (await getSettings(db)).customCategories;
  const trimmed = label.trim();
  if (!trimmed || current.includes(trimmed)) return current;
  const next = [...current, trimmed];
  await db.runAsync(
    'UPDATE settings SET custom_categories_json = ?, updated_at = ? WHERE id = 1',
    [JSON.stringify(next), nowMs()],
  );
  return next;
}

export async function setDayBoundaryHour(db: SQLiteDatabase, hour: number): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET day_boundary_hour = ?, updated_at = ? WHERE id = 1',
    [hour, nowMs()],
  );
}

export async function setObsidianVaultUri(
  db: SQLiteDatabase,
  uri: string | null,
): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET obsidian_vault_uri = ?, updated_at = ? WHERE id = 1',
    [uri, nowMs()],
  );
}

export async function setObsidianAutoExport(
  db: SQLiteDatabase,
  enabled: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET obsidian_auto_export = ?, updated_at = ? WHERE id = 1',
    [enabled ? 1 : 0, nowMs()],
  );
}
