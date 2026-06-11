import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Entry, Transcript } from '@/types/domain';

interface TranscriptRow {
  id: string;
  entry_id: string;
  raw_text: string;
  edited_text: string | null;
  engine: string;
  engine_version: string | null;
  language: string;
  confidence: number | null;
  segments_json: string | null;
  created_at: number;
}

function toTranscript(row: TranscriptRow): Transcript {
  return {
    id: row.id,
    entryId: row.entry_id,
    rawText: row.raw_text,
    editedText: row.edited_text ?? undefined,
    engine: row.engine,
    engineVersion: row.engine_version ?? undefined,
    language: row.language,
    confidence: row.confidence ?? undefined,
    segmentsJson: row.segments_json ?? undefined,
    createdAt: row.created_at,
  };
}

export async function insertTranscript(
  db: SQLiteDatabase,
  params: Omit<Transcript, 'id' | 'createdAt'>,
): Promise<Transcript> {
  const id = newId();
  const createdAt = nowMs();
  await db.runAsync(
    `INSERT INTO transcripts (
      id, entry_id, raw_text, edited_text, engine, engine_version,
      language, confidence, segments_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, params.entryId, params.rawText, params.editedText ?? null,
      params.engine, params.engineVersion ?? null, params.language,
      params.confidence ?? null, params.segmentsJson ?? null, createdAt,
    ],
  );
  return { ...params, id, createdAt };
}

// 가장 최근에 생성된 transcript 반환 (STT 엔진 재실행 시 여러 개 존재 가능)
export async function getLatestTranscript(
  db: SQLiteDatabase,
  entryId: string,
): Promise<Transcript | null> {
  const row = await db.getFirstAsync<TranscriptRow>(
    'SELECT * FROM transcripts WHERE entry_id = ? ORDER BY created_at DESC LIMIT 1',
    [entryId],
  );
  return row ? toTranscript(row) : null;
}

export async function getTranscriptsByEntry(
  db: SQLiteDatabase,
  entryId: string,
): Promise<Transcript[]> {
  const rows = await db.getAllAsync<TranscriptRow>(
    'SELECT * FROM transcripts WHERE entry_id = ? ORDER BY created_at DESC',
    [entryId],
  );
  return rows.map(toTranscript);
}

export async function updateEditedText(
  db: SQLiteDatabase,
  id: string,
  editedText: string,
): Promise<void> {
  await db.runAsync('UPDATE transcripts SET edited_text = ? WHERE id = ?', [editedText, id]);
}

// ── 전문 검색 ────────────────────────────────────────────────────────────────

export interface SearchResult {
  entry: Entry;
  snippet: string; // snippet() 함수 출력: <m>…</m> 마커로 강조 구간 표시
}

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
  deleted_at: number | null;
  snippet: string;
}

function toEntryFromRow(row: EntryRow): Entry {
  return {
    id: row.id,
    createdAt: row.created_at,
    recordedAt: row.recorded_at,
    originalPath: row.original_path,
    compressedPath: row.compressed_path ?? undefined,
    thumbnailPath: row.thumbnail_path ?? undefined,
    durationMs: row.duration_ms,
    mode: row.mode as Entry['mode'],
    manualNote: row.manual_note ?? undefined,
    compressionStatus: row.compression_status as Entry['compressionStatus'],
    aiLabelStatus: row.ai_label_status as Entry['aiLabelStatus'],
    sttStatus: row.stt_status as Entry['sttStatus'],
    metadataJson: row.metadata_json ?? undefined,
    userDecisionHint: row.user_decision_hint === 1,
    deletedAt: row.deleted_at ?? undefined,
  };
}

// FTS5 특수문자를 정리하고 각 단어 끝에 * 를 붙여 전방 일치 검색으로 변환.
// 예: "삼성 전자" → "삼성* 전자*" (삼성전자도 매칭)
function buildFtsQuery(raw: string): string | null {
  const clean = raw
    .trim()
    .replace(/[":*^()\[\]{}\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  return clean
    .split(' ')
    .filter(Boolean)
    .map((t) => `${t}*`)
    .join(' ');
}

export async function searchTranscripts(
  db: SQLiteDatabase,
  query: string,
  limit = 30,
): Promise<SearchResult[]> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  try {
    const rows = await db.getAllAsync<EntryRow>(
      `SELECT
         e.id, e.created_at, e.recorded_at, e.original_path, e.compressed_path,
         e.thumbnail_path, e.duration_ms, e.mode, e.manual_note,
         e.compression_status, e.ai_label_status, e.stt_status, e.metadata_json,
         e.user_decision_hint, e.deleted_at,
         snippet(transcripts_fts, 1, '<m>', '</m>', ' … ', 20) AS snippet
       FROM transcripts_fts
       JOIN entries e ON e.id = transcripts_fts.entry_id
       WHERE transcripts_fts MATCH ?
         AND e.deleted_at IS NULL
       ORDER BY e.recorded_at DESC
       LIMIT ?`,
      [ftsQuery, limit],
    );
    return rows.map((r) => ({ entry: toEntryFromRow(r), snippet: r.snippet }));
  } catch (e) {
    // FTS5 파싱 오류(잘못된 쿼리 등) 시 빈 결과 반환
    console.warn('[search] FTS5 query failed:', e);
    return [];
  }
}
