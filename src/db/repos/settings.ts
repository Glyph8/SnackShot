import type { SQLiteDatabase } from 'expo-sqlite';

import { nowMs } from '@/lib/time';

interface SettingsRow {
  id: number;
  day_boundary_hour: number;
  obsidian_vault_uri: string | null;
  obsidian_auto_export: number;
  custom_categories_json: string | null;
  backup_dir_uri: string | null;
  auto_purge_original: number;
  auto_manage_enabled: number;
  auto_l2_after_months: number;
  auto_l3_after_months: number;
  auto_backup_after_months: number;
  notifications_enabled: number;
  obsidian_inbox_last_hash: string | null;
  updated_at: number;
}

export interface Settings {
  dayBoundaryHour: number;
  obsidianVaultUri: string | null;
  obsidianAutoExport: boolean;
  customCategories: string[];
  // 영상 관리 (v12): 원본 백업 SAF 폴더 + 백업 후 원본 자동 정리 게이트.
  backupDirUri: string | null;
  autoPurgeOriginal: boolean;
  // 영상 관리 (v13): 자동 적용(스윕) 설정.
  autoManageEnabled: boolean;
  autoL2AfterMonths: number;
  autoL3AfterMonths: number;
  autoBackupAfterMonths: number;
  // 후속 확인 로컬 알림 (v16)
  notificationsEnabled: boolean;
  // 옵시디언 수신함 마지막 import 해시 (v17/E1) — 중복 방어
  obsidianInboxLastHash: string | null;
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
    backupDirUri: row.backup_dir_uri ?? null,
    autoPurgeOriginal: row.auto_purge_original === 1,
    autoManageEnabled: row.auto_manage_enabled === 1,
    autoL2AfterMonths: row.auto_l2_after_months,
    autoL3AfterMonths: row.auto_l3_after_months,
    autoBackupAfterMonths: row.auto_backup_after_months,
    notificationsEnabled: row.notifications_enabled === 1,
    obsidianInboxLastHash: row.obsidian_inbox_last_hash ?? null,
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

export async function setBackupDirUri(
  db: SQLiteDatabase,
  uri: string | null,
): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET backup_dir_uri = ?, updated_at = ? WHERE id = 1',
    [uri, nowMs()],
  );
}

export async function setAutoPurgeOriginal(
  db: SQLiteDatabase,
  enabled: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET auto_purge_original = ?, updated_at = ? WHERE id = 1',
    [enabled ? 1 : 0, nowMs()],
  );
}

export async function setAutoManageEnabled(
  db: SQLiteDatabase,
  enabled: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET auto_manage_enabled = ?, updated_at = ? WHERE id = 1',
    [enabled ? 1 : 0, nowMs()],
  );
}

// 자동 임계 개월 일괄 갱신 (L2/L3/백업). 음수·0 방지는 호출부(UI)에서.
export async function setAutoManageThresholds(
  db: SQLiteDatabase,
  l2Months: number,
  l3Months: number,
  backupMonths: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE settings
       SET auto_l2_after_months = ?, auto_l3_after_months = ?, auto_backup_after_months = ?, updated_at = ?
     WHERE id = 1`,
    [l2Months, l3Months, backupMonths, nowMs()],
  );
}


export async function setNotificationsEnabled(
  db: SQLiteDatabase,
  enabled: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET notifications_enabled = ?, updated_at = ? WHERE id = 1',
    [enabled ? 1 : 0, nowMs()],
  );
}


export async function setObsidianInboxLastHash(
  db: SQLiteDatabase,
  hash: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE settings SET obsidian_inbox_last_hash = ?, updated_at = ? WHERE id = 1',
    [hash, nowMs()],
  );
}
