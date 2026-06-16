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

export async function softDeleteOutcome(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE outcomes SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    [nowMs(), id],
  );
}
