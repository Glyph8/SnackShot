import type { SQLiteDatabase } from 'expo-sqlite';

import { makeRowMapper } from '@/db/mapping';
import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { TextRevision, TextRevisionKind, TextRevisionSource } from '@/types/domain';

const toTextRevision = makeRowMapper<TextRevision>({
  id: ['id', 'req'],
  targetKind: ['target_kind', 'req'],
  targetId: ['target_id', 'req'],
  field: ['field', 'req'],
  content: ['content', 'req'],
  source: ['source', 'req'],
  instruction: ['instruction', 'opt'],
  createdAt: ['created_at', 'req'],
});

export interface InsertRevisionParams {
  targetKind: TextRevisionKind;
  targetId: string;
  field: string;
  content: string;
  source: TextRevisionSource;
  instruction?: string;
}

export async function insertTextRevision(
  db: SQLiteDatabase,
  params: InsertRevisionParams,
): Promise<TextRevision> {
  const id = newId();
  const createdAt = nowMs();
  await db.runAsync(
    `INSERT INTO text_revisions (
      id, target_kind, target_id, field, content, source, instruction, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, params.targetKind, params.targetId, params.field,
      params.content, params.source, params.instruction ?? null, createdAt,
    ],
  );
  return { ...params, id, createdAt };
}

// 최신순(내림차순) — UI는 최신 버전을 맨 위에 보여준다.
export async function getTextRevisions(
  db: SQLiteDatabase,
  targetKind: TextRevisionKind,
  targetId: string,
  field: string,
): Promise<TextRevision[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM text_revisions
       WHERE target_kind = ? AND target_id = ? AND field = ?
       ORDER BY created_at DESC`,
    [targetKind, targetId, field],
  );
  return rows.map(toTextRevision);
}

export async function countTextRevisions(
  db: SQLiteDatabase,
  targetKind: TextRevisionKind,
  targetId: string,
  field: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM text_revisions
       WHERE target_kind = ? AND target_id = ? AND field = ?`,
    [targetKind, targetId, field],
  );
  return row?.n ?? 0;
}
