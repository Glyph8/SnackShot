import type { SQLiteDatabase } from 'expo-sqlite';

import { makeRowMapper } from '@/db/mapping';
import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Entry, Transcript } from '@/types/domain';

import { toEntry } from './entries';

const toTranscript = makeRowMapper<Transcript>({
  id: ['id', 'req'],
  entryId: ['entry_id', 'req'],
  rawText: ['raw_text', 'req'],
  editedText: ['edited_text', 'opt'],
  engine: ['engine', 'req'],
  engineVersion: ['engine_version', 'opt'],
  language: ['language', 'req'],
  confidence: ['confidence', 'opt'],
  segmentsJson: ['segments_json', 'opt'],
  createdAt: ['created_at', 'req'],
});

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
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM transcripts WHERE entry_id = ? ORDER BY created_at DESC LIMIT 1',
    [entryId],
  );
  return row ? toTranscript(row) : null;
}

export async function getTranscriptsByEntry(
  db: SQLiteDatabase,
  entryId: string,
): Promise<Transcript[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
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

// 검색 결과를 좁히는 선택 필터(아카이브 검색 칩).
//  - type: 'video'(voice/silent) | 'audio'(음성). 미지정 시 전체.
//  - decisionOnly: 추출된 결정이 있는 엔트리만.
//  - sinceMs: recorded_at >= sinceMs (기간 칩).
export interface SearchFilters {
  type?: 'video' | 'audio';
  decisionOnly?: boolean;
  sinceMs?: number;
}

// 검색 결과 entry는 @/db/repos/entries의 toEntry를 재사용한다(P2-1).
// SELECT에 없는 컬럼(exported_at 등)은 mapper가 undefined로 처리한다.

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
  filters: SearchFilters = {},
): Promise<SearchResult[]> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  // 선택 필터를 WHERE 절로 누적. 파라미터 순서: MATCH → (sinceMs) → LIMIT.
  const conds: string[] = [];
  const params: (string | number)[] = [ftsQuery];
  if (filters.type === 'video') conds.push("e.mode IN ('voice','silent')");
  else if (filters.type === 'audio') conds.push("e.mode = 'audio'");
  if (filters.decisionOnly) {
    conds.push('EXISTS (SELECT 1 FROM decisions d WHERE d.entry_id = e.id AND d.deleted_at IS NULL)');
  }
  if (filters.sinceMs != null) {
    conds.push('e.recorded_at >= ?');
    params.push(filters.sinceMs);
  }
  params.push(limit);
  const extraWhere = conds.length ? ` AND ${conds.join(' AND ')}` : '';

  try {
    const rows = await db.getAllAsync<Record<string, unknown> & { snippet: string }>(
      `SELECT
         e.id, e.created_at, e.recorded_at, e.original_path, e.compressed_path,
         e.thumbnail_path, e.duration_ms, e.mode, e.manual_note,
         e.compression_status, e.ai_label_status, e.stt_status, e.metadata_json,
         e.user_decision_hint, e.deleted_at,
         snippet(transcripts_fts, 1, '<m>', '</m>', ' … ', 20) AS snippet
       FROM transcripts_fts
       JOIN entries e ON e.id = transcripts_fts.entry_id
       WHERE transcripts_fts MATCH ?
         AND e.deleted_at IS NULL${extraWhere}
       ORDER BY e.recorded_at DESC
       LIMIT ?`,
      params,
    );
    return rows.map((r) => ({ entry: toEntry(r), snippet: r.snippet }));
  } catch (e) {
    // FTS5 파싱 오류(잘못된 쿼리 등) 시 빈 결과 반환
    console.warn('[search] FTS5 query failed:', e);
    return [];
  }
}
