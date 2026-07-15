import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import { makeRowMapper } from '@/db/mapping';
import type { Outcome } from '@/types/domain';

const toOutcome = makeRowMapper<Outcome>({
  id: ['id', 'req'],
  decisionId: ['decision_id', 'req'],
  entryId: ['entry_id', 'opt'],
  result: ['result', 'req'],
  reflection: ['reflection', 'opt'],
  learnings: ['learnings', 'opt'],
  aiEngine: ['ai_engine', 'opt'],
  createdAt: ['created_at', 'req'],
  deletedAt: ['deleted_at', 'opt'],
});

export async function insertOutcome(
  db: SQLiteDatabase,
  params: Omit<Outcome, 'id' | 'createdAt' | 'deletedAt'>,
): Promise<Outcome> {
  const id = newId();
  const createdAt = nowMs();
  await db.runAsync(
    `INSERT INTO outcomes (id, decision_id, entry_id, result, reflection, learnings, ai_engine, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, params.decisionId, params.entryId ?? null,
      params.result, params.reflection ?? null,
      params.learnings ?? null, params.aiEngine ?? null, createdAt,
    ],
  );
  return { ...params, id, createdAt };
}

export async function getOutcomeByDecision(
  db: SQLiteDatabase,
  decisionId: string,
): Promise<Outcome | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM outcomes WHERE decision_id = ? AND deleted_at IS NULL',
    [decisionId],
  );
  return row ? toOutcome(row) : null;
}

// I1: 회고 타임라인 — soft-deleted 포함 전체 회고를 최신순으로. deleted_at 있는 행은
// "잠정 판단(재확인으로 되돌림)"(F4)이므로 화면에서 라벨만 다르게 표시(복원 액션 없음, 열람 전용).
export async function getOutcomeHistory(
  db: SQLiteDatabase,
  decisionId: string,
): Promise<Outcome[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM outcomes WHERE decision_id = ? ORDER BY created_at DESC',
    [decisionId],
  );
  return rows.map(toOutcome);
}

export async function softDeleteOutcome(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE outcomes SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    [nowMs(), id],
  );
}
