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

// G3: 재수정률 계기판 — AI 재작성(source=ai_rewrite) 이후 24h 내
// 같은 target·field에 사용자 재수정(source=manual)이 있는 비율.
// 프롬프트(G1/G2) 개선 효과의 계기판 용도. 낮을수록 AI 출력이 그대로 채택됨.
const REEDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function getAiRewriteReeditRate(
  db: SQLiteDatabase,
): Promise<{ total: number; reedited: number; ratio: number }> {
  const row = await db.getFirstAsync<{ total: number; reedited: number }>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM text_revisions m
          WHERE m.target_kind = r.target_kind
            AND m.target_id = r.target_id
            AND m.field = r.field
            AND m.source = 'manual'
            AND m.created_at > r.created_at
            AND m.created_at <= r.created_at + ?
       ) THEN 1 ELSE 0 END) AS reedited
     FROM text_revisions r
     WHERE r.source = 'ai_rewrite'`,
    [REEDIT_WINDOW_MS],
  );
  const total = row?.total ?? 0;
  const reedited = row?.reedited ?? 0;
  return { total, reedited, ratio: total > 0 ? reedited / total : 0 };
}
