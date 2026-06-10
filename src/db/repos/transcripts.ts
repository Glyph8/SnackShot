import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Transcript } from '@/types/domain';

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
