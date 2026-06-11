import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Decision, DecisionCategory, DecisionStatus } from '@/types/domain';

interface DecisionRow {
  id: string;
  entry_id: string;
  summary: string;
  category: string;
  reasoning: string | null;
  alternatives: string | null;
  expected_outcome: string | null;
  evidence_quote: string | null;
  confidence: number;
  user_summary: string | null;
  user_category: string | null;
  user_reasoning: string | null;
  status: string;
  follow_up_at: number | null;
  follow_up_set_by: string | null;
  extracted_at: number;
  confirmed_at: number | null;
  ai_engine: string;
  tags_json: string | null;
  deleted_at: number | null;
}

function toDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    entryId: row.entry_id,
    summary: row.summary,
    category: row.category as DecisionCategory,
    reasoning: row.reasoning ?? undefined,
    alternatives: row.alternatives ?? undefined,
    expectedOutcome: row.expected_outcome ?? undefined,
    evidenceQuote: row.evidence_quote ?? undefined,
    confidence: row.confidence,
    userSummary: row.user_summary ?? undefined,
    userCategory: row.user_category ? (row.user_category as DecisionCategory) : undefined,
    userReasoning: row.user_reasoning ?? undefined,
    status: row.status as DecisionStatus,
    followUpAt: row.follow_up_at ?? undefined,
    followUpSetBy: row.follow_up_set_by ?? undefined,
    extractedAt: row.extracted_at,
    confirmedAt: row.confirmed_at ?? undefined,
    aiEngine: row.ai_engine,
    tagsJson: row.tags_json ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

type InsertDecisionParams = Omit<Decision, 'id' | 'deletedAt'>;

export async function insertDecision(
  db: SQLiteDatabase,
  params: InsertDecisionParams,
): Promise<Decision> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO decisions (
      id, entry_id, summary, category, reasoning, alternatives,
      expected_outcome, evidence_quote, confidence,
      user_summary, user_category, user_reasoning,
      status, follow_up_at, follow_up_set_by,
      extracted_at, confirmed_at, ai_engine, tags_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, params.entryId, params.summary, params.category,
      params.reasoning ?? null, params.alternatives ?? null,
      params.expectedOutcome ?? null, params.evidenceQuote ?? null,
      params.confidence,
      params.userSummary ?? null, params.userCategory ?? null, params.userReasoning ?? null,
      params.status,
      params.followUpAt ?? null, params.followUpSetBy ?? null,
      params.extractedAt, params.confirmedAt ?? null,
      params.aiEngine, params.tagsJson ?? null,
    ],
  );
  return { ...params, id };
}

export async function getDecision(
  db: SQLiteDatabase,
  id: string,
): Promise<Decision | null> {
  const row = await db.getFirstAsync<DecisionRow>(
    'SELECT * FROM decisions WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? toDecision(row) : null;
}

export async function getDecisionsByEntry(
  db: SQLiteDatabase,
  entryId: string,
): Promise<Decision[]> {
  const rows = await db.getAllAsync<DecisionRow>(
    'SELECT * FROM decisions WHERE entry_id = ? AND deleted_at IS NULL ORDER BY extracted_at DESC',
    [entryId],
  );
  return rows.map(toDecision);
}

// Inbox 탭 — AI가 추출했지만 사용자 미확인 목록
export async function getPendingDecisions(db: SQLiteDatabase): Promise<Decision[]> {
  const rows = await db.getAllAsync<DecisionRow>(
    `SELECT * FROM decisions
     WHERE status = 'extracted' AND deleted_at IS NULL
     ORDER BY extracted_at DESC`,
  );
  return rows.map(toDecision);
}

// follow_up_at이 지난 결정 — 후속 확인 알림용 (ADR-017)
export async function getDecisionsDueForFollowUp(
  db: SQLiteDatabase,
  asOfMs: number,
): Promise<Decision[]> {
  const rows = await db.getAllAsync<DecisionRow>(
    `SELECT * FROM decisions
     WHERE follow_up_at IS NOT NULL AND follow_up_at <= ?
       AND deleted_at IS NULL AND status != 'rejected'
     ORDER BY follow_up_at ASC`,
    [asOfMs],
  );
  return rows.map(toDecision);
}

export async function updateDecisionStatus(
  db: SQLiteDatabase,
  id: string,
  status: DecisionStatus,
): Promise<void> {
  if (status === 'confirmed') {
    await db.runAsync(
      'UPDATE decisions SET status = ?, confirmed_at = ? WHERE id = ? AND deleted_at IS NULL',
      [status, nowMs(), id],
    );
  } else {
    await db.runAsync(
      'UPDATE decisions SET status = ? WHERE id = ? AND deleted_at IS NULL',
      [status, id],
    );
  }
}

// 사용자 편집본 저장 — AI 원본 컬럼은 건드리지 않음 (ADR-016)
export async function updateUserEdit(
  db: SQLiteDatabase,
  id: string,
  patch: {
    userSummary?: string;
    userCategory?: DecisionCategory;
    userReasoning?: string;
    followUpAt?: number;
  },
): Promise<void> {
  await db.runAsync(
    `UPDATE decisions
     SET user_summary    = COALESCE(?, user_summary),
         user_category   = COALESCE(?, user_category),
         user_reasoning  = COALESCE(?, user_reasoning),
         follow_up_at    = COALESCE(?, follow_up_at),
         status          = 'edited'
     WHERE id = ? AND deleted_at IS NULL`,
    [
      patch.userSummary ?? null,
      patch.userCategory ?? null,
      patch.userReasoning ?? null,
      patch.followUpAt ?? null,
      id,
    ],
  );
}

export async function softDeleteDecision(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE decisions SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    [nowMs(), id],
  );
}
