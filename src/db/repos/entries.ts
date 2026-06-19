import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import { makeRowMapper } from '@/db/mapping';
import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Entry, EntryMode, ProcessingStatus } from '@/types/domain';

// row(snake) → Entry 매핑 단일 진실원 (P2-1).
// Entry에 필드를 추가하면 여기 누락 시 컴파일 에러가 난다.
// search 등 일부 컬럼만 SELECT하는 쿼리에서도 재사용 가능(없는 컬럼은 undefined 처리).
export const toEntry = makeRowMapper<Entry>({
  id: ['id', 'req'],
  createdAt: ['created_at', 'req'],
  recordedAt: ['recorded_at', 'req'],
  originalPath: ['original_path', 'req'],
  compressedPath: ['compressed_path', 'opt'],
  thumbnailPath: ['thumbnail_path', 'opt'],
  durationMs: ['duration_ms', 'req'],
  mode: ['mode', 'req'],
  manualNote: ['manual_note', 'opt'],
  compressionStatus: ['compression_status', 'req'],
  aiLabelStatus: ['ai_label_status', 'req'],
  sttStatus: ['stt_status', 'req'],
  metadataJson: ['metadata_json', 'opt'],
  userDecisionHint: ['user_decision_hint', 'bool'],
  exportedAt: ['exported_at', 'opt'],
  compressionLevel: ['compression_level', 'opt'],
  originalBackedUpAt: ['original_backed_up_at', 'opt'],
  originalPurgedAt: ['original_purged_at', 'opt'],
  backupUri: ['backup_uri', 'opt'],
  deletedAt: ['deleted_at', 'opt'],
});

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
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM entries WHERE id = ?', [id]);
  if (!row) throw new Error(`[entries] insert failed: ${id}`);
  return toEntry(row);
}

/**
 * 텍스트 전용 entry 작성 (mode='text').
 *
 * 미디어 파일이 없으므로 original_path는 빈 문자열 ''로 저장한다(ADR-003 노트).
 * - duration_ms = 0
 * - compression_status = 'skipped' (압축할 파일 없음)
 * - stt_status = 'skipped' (음성 없음)
 * - ai_label_status = 'pending' (manual_note 텍스트가 label_extraction 입력)
 *
 * manual_note는 동일 INSERT로 atomic하게 저장한다. 빈 문자열도 허용하지만 호출자가
 * 비어있지 않음을 보장하는 것이 권장된다(label_extraction 핸들러가 빈 텍스트는
 * skipped 처리하므로 안전망은 있음).
 */
export async function insertTextEntry(
  db: SQLiteDatabase,
  params: {
    recordedAt: number;
    body: string;
  },
): Promise<Entry> {
  const id = newId();
  const createdAt = nowMs();
  await db.runAsync(
    `INSERT INTO entries (
      id, created_at, recorded_at, original_path, duration_ms, mode,
      manual_note, compression_status, ai_label_status, stt_status, user_decision_hint
    ) VALUES (?, ?, ?, '', 0, 'text', ?, 'skipped', 'pending', 'skipped', 0)`,
    [id, createdAt, params.recordedAt, params.body],
  );
  // FTS 인덱싱 트리거 강제 발화 (fts_entries_update_note는 UPDATE OF manual_note에만 반응).
  // INSERT 시점에는 entries_fts에 자동 등록되지 않으므로, 동일 값으로 UPDATE하여 트리거를 깨운다.
  await db.runAsync(
    'UPDATE entries SET manual_note = ? WHERE id = ?',
    [params.body, id],
  );
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM entries WHERE id = ?', [id]);
  if (!row) throw new Error(`[entries] insertTextEntry failed: ${id}`);
  return toEntry(row);
}

export async function getEntry(
  db: SQLiteDatabase,
  id: string,
): Promise<Entry | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
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
  const rows = await db.getAllAsync<Record<string, unknown>>(
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
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entries
     WHERE recorded_at < ? AND deleted_at IS NULL
     ORDER BY recorded_at DESC LIMIT ?`,
    [beforeMs, limit],
  );
  return rows.map(toEntry);
}

// 용량 관리 화면(P4): 미디어 엔트리 전체(최신순). text 제외, soft delete 제외.
export async function getAllMediaEntries(
  db: SQLiteDatabase,
  limit = 1000,
): Promise<Entry[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entries
     WHERE deleted_at IS NULL AND mode != 'text'
     ORDER BY recorded_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toEntry);
}

// 자동 스윕(P3): 단계 상향 후보 — 압축 완료된 영상 중 아직 최종 단계 미만이고
// 원본이 남아 있으며 기준 시각 이전 녹화. 오래된 것부터.
export async function getEntriesForAutoCompress(
  db: SQLiteDatabase,
  maxRecordedAt: number,
  limit: number,
): Promise<Entry[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entries
     WHERE deleted_at IS NULL
       AND mode IN ('voice','silent')
       AND compression_status = 'done'
       AND compression_level < 3
       AND original_purged_at IS NULL
       AND recorded_at <= ?
     ORDER BY recorded_at ASC LIMIT ?`,
    [maxRecordedAt, limit],
  );
  return rows.map(toEntry);
}

// 자동 스윕(P3): 백업 후보 — 아직 백업되지 않고 원본이 남아 있는 미디어 엔트리.
export async function getEntriesForAutoBackup(
  db: SQLiteDatabase,
  maxRecordedAt: number,
  limit: number,
): Promise<Entry[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entries
     WHERE deleted_at IS NULL
       AND mode != 'text'
       AND original_backed_up_at IS NULL
       AND original_purged_at IS NULL
       AND recorded_at <= ?
     ORDER BY recorded_at ASC LIMIT ?`,
    [maxRecordedAt, limit],
  );
  return rows.map(toEntry);
}

export async function updateCompressionResult(
  db: SQLiteDatabase,
  id: string,
  status: ProcessingStatus,
  compressedPath?: string,
  thumbnailPath?: string,
  level?: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE entries
     SET compression_status = ?,
         compressed_path = COALESCE(?, compressed_path),
         thumbnail_path = COALESCE(?, thumbnail_path),
         compression_level = COALESCE(?, compression_level)
     WHERE id = ? AND deleted_at IS NULL`,
    [status, compressedPath ?? null, thumbnailPath ?? null, level ?? null, id],
  );
}

// 원본 외부 백업 완료 기록 (v12). backup_uri는 표시용 위치.
export async function markOriginalBackedUp(
  db: SQLiteDatabase,
  id: string,
  backupUri: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE entries
     SET original_backed_up_at = ?, backup_uri = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [nowMs(), backupUri, id],
  );
}

// 백업 후 로컬 원본 삭제 기록 (v12). 실제 파일 삭제는 호출자(핸들러)가 수행.
export async function markOriginalPurged(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE entries
     SET original_purged_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [nowMs(), id],
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

// 저장 용량 분석용 — 미디어 경로 + 모드 + 시각
export interface EntryMedia {
  mode: EntryMode;
  recordedAt: number;
  originalPath: string;
  compressedPath?: string;
  thumbnailPath?: string;
}

export async function getAllEntryMedia(db: SQLiteDatabase): Promise<EntryMedia[]> {
  const rows = await db.getAllAsync<{
    mode: string; recorded_at: number;
    original_path: string; compressed_path: string | null; thumbnail_path: string | null;
  }>(
    `SELECT mode, recorded_at, original_path, compressed_path, thumbnail_path
     FROM entries WHERE deleted_at IS NULL`,
  );
  return rows.map((r) => ({
    mode: r.mode as EntryMode,
    recordedAt: r.recorded_at,
    originalPath: r.original_path,
    compressedPath: r.compressed_path ?? undefined,
    thumbnailPath: r.thumbnail_path ?? undefined,
  }));
}
