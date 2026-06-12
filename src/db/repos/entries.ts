import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Entry, EntryMode, ProcessingStatus } from '@/types/domain';

interface EntryRow {
  id: string;
  created_at: number;
  recorded_at: number;
  original_path: string;
  compressed_path: string | null;
  thumbnail_path: string | null;
  duration_ms: number;
  mode: string;
  manual_note: string | null;
  compression_status: string;
  ai_label_status: string;
  stt_status: string;
  metadata_json: string | null;
  user_decision_hint: number;
  exported_at: number | null;
  deleted_at: number | null;
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    createdAt: row.created_at,
    recordedAt: row.recorded_at,
    originalPath: row.original_path,
    compressedPath: row.compressed_path ?? undefined,
    thumbnailPath: row.thumbnail_path ?? undefined,
    durationMs: row.duration_ms,
    mode: row.mode as EntryMode,
    manualNote: row.manual_note ?? undefined,
    compressionStatus: row.compression_status as ProcessingStatus,
    aiLabelStatus: row.ai_label_status as ProcessingStatus,
    sttStatus: row.stt_status as ProcessingStatus,
    metadataJson: row.metadata_json ?? undefined,
    userDecisionHint: row.user_decision_hint === 1,
    exportedAt: row.exported_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export async function insertEntry(
  db: SQLiteDatabase,
  params: {
    recordedAt: number;
    originalPath: string;
    durationMs: number;
    mode: EntryMode;
  },
): Promise<Entry> {
  const id = newId();
  const createdAt = nowMs();
  await db.runAsync(
    `INSERT INTO entries (
      id, created_at, recorded_at, original_path, duration_ms, mode,
      compression_status, ai_label_status, stt_status, user_decision_hint
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', 0)`,
    [id, createdAt, params.recordedAt, params.originalPath, params.durationMs, params.mode],
  );
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE id = ?', [id]);
  if (!row) throw new Error(`[entries] insert failed: ${id}`);
  return toEntry(row);
}

export async function getEntry(
  db: SQLiteDatabase,
  id: string,
): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entries WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? toEntry(row) : null;
}

// 하루 범위 조회 — getDayBoundary()로 계산한 startMs/endMs 사용
export async function getEntriesByDay(
  db: SQLiteDatabase,
  startMs: number,
  endMs: number,
): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries
     WHERE recorded_at >= ? AND recorded_at < ? AND deleted_at IS NULL
     ORDER BY recorded_at DESC`,
    [startMs, endMs],
  );
  return rows.map(toEntry);
}

// 아카이브용 페이지네이션 (beforeMs 커서 방식)
export async function getEntriesPage(
  db: SQLiteDatabase,
  beforeMs: number,
  limit: number,
): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries
     WHERE recorded_at < ? AND deleted_at IS NULL
     ORDER BY recorded_at DESC LIMIT ?`,
    [beforeMs, limit],
  );
  return rows.map(toEntry);
}

export async function updateCompressionResult(
  db: SQLiteDatabase,
  id: string,
  status: ProcessingStatus,
  compressedPath?: string,
  thumbnailPath?: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE entries
     SET compression_status = ?,
         compressed_path = COALESCE(?, compressed_path),
         thumbnail_path = COALESCE(?, thumbnail_path)
     WHERE id = ? AND deleted_at IS NULL`,
    [status, compressedPath ?? null, thumbnailPath ?? null, id],
  );
}

export async function updateAiLabelStatus(
  db: SQLiteDatabase,
  id: string,
  status: ProcessingStatus,
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET ai_label_status = ? WHERE id = ? AND deleted_at IS NULL',
    [status, id],
  );
}

export async function updateSttStatus(
  db: SQLiteDatabase,
  id: string,
  status: ProcessingStatus,
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET stt_status = ? WHERE id = ? AND deleted_at IS NULL',
    [status, id],
  );
}

export async function updateManualNote(
  db: SQLiteDatabase,
  id: string,
  note: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET manual_note = ? WHERE id = ? AND deleted_at IS NULL',
    [note, id],
  );
}

export async function setUserDecisionHint(
  db: SQLiteDatabase,
  id: string,
  hint: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET user_decision_hint = ? WHERE id = ? AND deleted_at IS NULL',
    [hint ? 1 : 0, id],
  );
}

/**
 * 월간 날짜별 클립 카운트 (ADR-013: 하루 경계 적용).
 * SQL GROUP BY 대신 JS에서 그룹핑 — boundaryHour 오프셋을 Date로 정확하게 처리.
 * 반환: { 'YYYY-MM-DD': count }
 */
export async function countEntriesByMonth(
  db: SQLiteDatabase,
  startMs: number,
  endMs: number,
  boundaryHour: number,
): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ recorded_at: number }>(
    `SELECT recorded_at FROM entries
     WHERE recorded_at >= ? AND recorded_at < ? AND deleted_at IS NULL`,
    [startMs, endMs],
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    // boundaryHour만큼 뒤로 shift하면 논리적 날짜의 자정으로 매핑됨
    const logicalDate = format(
      new Date(row.recorded_at - boundaryHour * 3_600_000),
      'yyyy-MM-dd',
    );
    counts[logicalDate] = (counts[logicalDate] ?? 0) + 1;
  }
  return counts;
}

export async function updateExportedAt(
  db: SQLiteDatabase,
  id: string,
  ts: number,
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET exported_at = ? WHERE id = ? AND deleted_at IS NULL',
    [ts, id],
  );
}

export async function clearExportedAt(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET exported_at = NULL WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
}

export async function softDeleteEntry(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    [nowMs(), id],
  );
}

// 재export/일괄 처리용 — ADR-014: WHERE deleted_at IS NULL 필수.
export async function countAllEntries(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM entries WHERE deleted_at IS NULL',
  );
  return row?.count ?? 0;
}

export async function getAllEntryIds(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM entries
     WHERE deleted_at IS NULL
     ORDER BY recorded_at ASC`,
  );
  return rows.map((r) => r.id);
}

// 전체 일괄 export용 (id+recordedAt만 필요). N번 getEntry보다 단일 SELECT가 효율적.
export async function getAllEntryBasics(
  db: SQLiteDatabase,
): Promise<Array<{ id: string; recordedAt: number }>> {
  const rows = await db.getAllAsync<{ id: string; recorded_at: number }>(
    `SELECT id, recorded_at FROM entries
     WHERE deleted_at IS NULL
     ORDER BY recorded_at ASC`,
  );
  return rows.map((r) => ({ id: r.id, recordedAt: r.recorded_at }));
}
