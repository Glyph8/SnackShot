import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Outcome, OutcomeResult } from '@/types/domain';

interface OutcomeRow {
  id: string;
  decision_id: string;
  entry_id: string | null;
  result: string;
  reflection: string | null;
  learnings: string | null;
  ai_engine: string | null;
  created_at: number;
  deleted_at: number | null;
}

function toOutcome(row: OutcomeRow): Outcome {
  return {
    id: row.id,
    decisionId: row.decision_id,
    entryId: row.entry_id ?? undefined,
    result: row.result as OutcomeResult,
    reflection: row.reflection ?? undefined,
    learnings: row.learnings ?? undefined,
    aiEngine: row.ai_engine ?? undefined,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

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
  const row = await db.getFirstAsync<OutcomeRow>(
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
