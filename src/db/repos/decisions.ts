import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import { buildFtsQuery } from '@/db/fts';
import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import { makeRowMapper } from '@/db/mapping';
import type { Decision, DecisionCategory, DecisionStatus, OutcomeResult } from '@/types/domain';

export const toDecision = makeRowMapper<Decision>({
  id: ['id', 'req'],
  entryId: ['entry_id', 'req'],
  summary: ['summary', 'req'],
  category: ['category', 'req'],
  customCategory: ['custom_category', 'opt'],
  situation: ['situation', 'opt'],
  reasoning: ['reasoning', 'opt'],
  alternatives: ['alternatives', 'opt'],
  expectedOutcome: ['expected_outcome', 'opt'],
  evidenceQuote: ['evidence_quote', 'opt'],
  confidence: ['confidence', 'req'],
  userSummary: ['user_summary', 'opt'],
  userCategory: ['user_category', 'opt'],
  userSituation: ['user_situation', 'opt'],
  userReasoning: ['user_reasoning', 'opt'],
  status: ['status', 'req'],
  origin: ['origin', 'req'],
  followUpAt: ['follow_up_at', 'opt'],
  followUpSetBy: ['follow_up_set_by', 'opt'],
  extractedAt: ['extracted_at', 'req'],
  confirmedAt: ['confirmed_at', 'opt'],
  executedAt: ['executed_at', 'opt'],
  aiEngine: ['ai_engine', 'req'],
  tagsJson: ['tags_json', 'opt'],
  deletedAt: ['deleted_at', 'opt'],
});

// 타임라인 인레이용 — 결정이 진행된 시각(실행 > 확정 > 추출)을 같은 축에 올린다.
export interface TimelineDecision {
  decision: Decision;
  sortTs: number;
}

// 확정/수정된 결정만, 진행 시각 기준 최신순(전체 로드 — 보통 소량).
// 텍스트 엔트리에서 나온 결정은 그 텍스트 카드 자체가 '의사결정'으로 표시되므로 제외(중복 방지).
// 즉 녹음(영상/음성)에서 추출된 결정만 별도 비트로 인레이한다.
export async function getTimelineDecisions(db: SQLiteDatabase): Promise<TimelineDecision[]> {
  const rows = await db.getAllAsync<Record<string, unknown> & { sort_ts: number }>(
    `SELECT d.*, COALESCE(d.executed_at, d.confirmed_at, d.extracted_at) AS sort_ts
     FROM decisions d
     JOIN entries e ON e.id = d.entry_id AND e.deleted_at IS NULL AND e.mode != 'text'
     WHERE d.deleted_at IS NULL
       AND d.status IN ('confirmed', 'edited')
     ORDER BY sort_ts DESC`,
  );
  return rows.map((r) => ({ decision: toDecision(r), sortTs: Number(r.sort_ts) }));
}

type InsertDecisionParams = Omit<Decision, 'id' | 'deletedAt'>;

export async function insertDecision(
  db: SQLiteDatabase,
  params: InsertDecisionParams,
): Promise<Decision> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO decisions (
      id, entry_id, summary, category, custom_category, situation, reasoning, alternatives,
      expected_outcome, evidence_quote, confidence,
      user_summary, user_category, user_situation, user_reasoning,
      status, origin, follow_up_at, follow_up_set_by,
      extracted_at, confirmed_at, executed_at, ai_engine, tags_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, params.entryId, params.summary, params.category, params.customCategory ?? null,
      params.situation ?? null,
      params.reasoning ?? null, params.alternatives ?? null,
      params.expectedOutcome ?? null, params.evidenceQuote ?? null,
      params.confidence,
      params.userSummary ?? null, params.userCategory ?? null,
      params.userSituation ?? null, params.userReasoning ?? null,
      params.status, params.origin,
      params.followUpAt ?? null, params.followUpSetBy ?? null,
      params.extractedAt, params.confirmedAt ?? null, params.executedAt ?? null,
      params.aiEngine, params.tagsJson ?? null,
    ],
  );
  return { ...params, id };
}

export async function getDecision(
  db: SQLiteDatabase,
  id: string,
): Promise<Decision | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM decisions WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? toDecision(row) : null;
}

export async function getDecisionsByEntry(
  db: SQLiteDatabase,
  entryId: string,
): Promise<Decision[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM decisions WHERE entry_id = ? AND deleted_at IS NULL ORDER BY extracted_at DESC',
    [entryId],
  );
  return rows.map(toDecision);
}

// Inbox 탭 — AI가 추출했지만 사용자 미확인 목록
export async function getPendingDecisions(db: SQLiteDatabase): Promise<Decision[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM decisions
     WHERE status = 'extracted' AND deleted_at IS NULL
     ORDER BY extracted_at DESC`,
  );
  return rows.map(toDecision);
}

// confirmed/edited이고 follow_up_at이 지났으며 결과가 아직 없는 결정 (ADR-017)
// outcomes는 decision_id 단방향 참조 — decisions.outcome_id는 v6에서 제거됨
export async function getDecisionsDueForFollowUp(
  db: SQLiteDatabase,
  asOfMs: number,
): Promise<Decision[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM decisions
     WHERE follow_up_at IS NOT NULL AND follow_up_at <= ?
       AND deleted_at IS NULL
       AND executed_at IS NULL
       AND status IN ('confirmed', 'edited')
       AND NOT EXISTS (
         SELECT 1 FROM outcomes
         WHERE outcomes.decision_id = decisions.id
           AND outcomes.deleted_at IS NULL
       )
     ORDER BY follow_up_at ASC`,
    [asOfMs],
  );
  return rows.map(toDecision);
}

export async function countDecisionsDueForFollowUp(
  db: SQLiteDatabase,
  asOfMs: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM decisions
     WHERE follow_up_at IS NOT NULL AND follow_up_at <= ?
       AND deleted_at IS NULL
       AND executed_at IS NULL
       AND status IN ('confirmed', 'edited')
       AND NOT EXISTS (
         SELECT 1 FROM outcomes
         WHERE outcomes.decision_id = decisions.id
           AND outcomes.deleted_at IS NULL
       )`,
    [asOfMs],
  );
  return row?.count ?? 0;
}

// 결정 보드(todo) — 확정(confirmed/edited)되었고 아직 수행 완료/결과 기록이 없는 "진행 중" 결정.
// 후속 확인 도래분(follow_up_at <= now)은 getDecisionsDueForFollowUp가 담당하므로 제외한다. (v8)
export async function getActiveUpcomingDecisions(
  db: SQLiteDatabase,
  asOfMs: number,
): Promise<Decision[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM decisions
     WHERE status IN ('confirmed', 'edited')
       AND executed_at IS NULL
       AND deleted_at IS NULL
       AND (follow_up_at IS NULL OR follow_up_at > ?)
       AND NOT EXISTS (
         SELECT 1 FROM outcomes
         WHERE outcomes.decision_id = decisions.id
           AND outcomes.deleted_at IS NULL
       )
     ORDER BY COALESCE(confirmed_at, extracted_at) DESC`,
    [asOfMs],
  );
  return rows.map(toDecision);
}

// 수행 완료 체크 — executed_at 기록으로 활성 보드에서 제거. 결과(outcome) 기록은 선택. (v8)
// executed_at IS NULL 조건으로 멱등 — 이미 수행 완료된 결정의 시각은 덮어쓰지 않는다
// (회고 대기 7일 윈도우가 최초 수행 시각 기준이어야 하므로).
export async function markDecisionExecuted(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE decisions SET executed_at = ? WHERE id = ? AND deleted_at IS NULL AND executed_at IS NULL',
    [nowMs(), id],
  );
}

// 수행 완료 체크 취소 — executed_at을 비워 다시 "진행 중"으로 되돌린다. (v8 Phase 4.1)
export async function unmarkDecisionExecuted(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE decisions SET executed_at = NULL WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
}

// 엔트리의 대표 결정(확정/수정) 1건 — Today에서 텍스트 엔트리가 '의사결정'인지 판별·수정 이동용. (v8 Phase 4.1)
export async function getPrimaryDecisionForEntry(
  db: SQLiteDatabase,
  entryId: string,
): Promise<Decision | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM decisions
     WHERE entry_id = ? AND deleted_at IS NULL AND status IN ('confirmed', 'edited')
     ORDER BY COALESCE(confirmed_at, extracted_at) DESC
     LIMIT 1`,
    [entryId],
  );
  return row ? toDecision(row) : null;
}

// 의사결정 모아보기 — Inbox에서 처리된(컨펌/수정/반려) 모든 결정. 상태/결과는 화면에서 파생. (v8 Phase 4.1)
export async function getAllDecisions(db: SQLiteDatabase): Promise<Decision[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM decisions
     WHERE status IN ('confirmed', 'edited', 'rejected') AND deleted_at IS NULL
     ORDER BY COALESCE(confirmed_at, extracted_at) DESC`,
  );
  return rows.map(toDecision);
}

// 회고 대기 — 수행 완료(executed_at)됐지만 아직 결과(outcome)가 없는 결정.
// 수행 후 windowMs(기본 7일) 이내만 노출 → 그 뒤엔 결과 없이 종료(목록에서 자연 제외). (v8 Phase 4)
export async function getPendingReflectionDecisions(
  db: SQLiteDatabase,
  asOfMs: number,
  windowMs: number,
): Promise<Decision[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM decisions
     WHERE executed_at IS NOT NULL
       AND executed_at >= ?
       AND deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM outcomes
         WHERE outcomes.decision_id = decisions.id
           AND outcomes.deleted_at IS NULL
       )
     ORDER BY executed_at DESC`,
    [asOfMs - windowMs],
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
// followUpAt 변경 시 followUpSetBy='user' 를 함께 전달해야 함 (ADR-017)
export async function updateUserEdit(
  db: SQLiteDatabase,
  id: string,
  patch: {
    userSummary?: string;
    userCategory?: DecisionCategory;
    /** 커스텀 카테고리 라벨('' = 해제). undefined면 기존 값 유지 */
    customCategory?: string;
    userSituation?: string;
    userReasoning?: string;
    followUpAt?: number;
    followUpSetBy?: string;
  },
): Promise<void> {
  await db.runAsync(
    `UPDATE decisions
     SET user_summary      = COALESCE(?, user_summary),
         user_category     = COALESCE(?, user_category),
         custom_category   = COALESCE(?, custom_category),
         user_situation    = COALESCE(?, user_situation),
         user_reasoning    = COALESCE(?, user_reasoning),
         follow_up_at      = COALESCE(?, follow_up_at),
         follow_up_set_by  = COALESCE(?, follow_up_set_by),
         status            = 'edited'
     WHERE id = ? AND deleted_at IS NULL`,
    [
      patch.userSummary ?? null,
      patch.userCategory ?? null,
      patch.customCategory ?? null,
      patch.userSituation ?? null,
      patch.userReasoning ?? null,
      patch.followUpAt ?? null,
      patch.followUpSetBy ?? null,
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

// Today 화면 배지용 — AI가 추출했지만 사용자 미확인 건수 (Step 3에서 UI 표시)
export async function countExtractedDecisions(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM decisions
     WHERE status = 'extracted' AND deleted_at IS NULL`,
  );
  return row?.count ?? 0;
}
// ── 결정 전문 검색 (D1) ────────────────────────────────────────────────────────
// decisions_fts(v15)를 질의. searchTranscripts 미러 구조.

export interface DecisionSearchResult {
  decision: Decision;
  snippet: string; // snippet() 출력: <m>…</m> 마커로 강조 구간 표시
}

// 검색 범위를 좁히는 선택 필터. 아카이브 기간 칩과 공용(단, 기준 시각은 extracted_at).
export interface DecisionSearchFilters {
  sinceMs?: number;
}

export async function searchDecisions(
  db: SQLiteDatabase,
  query: string,
  limit = 30,
  filters: DecisionSearchFilters = {},
): Promise<DecisionSearchResult[]> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  // 파라미터 순서: MATCH → (sinceMs) → LIMIT.
  const conds: string[] = [];
  const params: (string | number)[] = [ftsQuery];
  if (filters.sinceMs != null) {
    conds.push('d.extracted_at >= ?');
    params.push(filters.sinceMs);
  }
  params.push(limit);
  const extraWhere = conds.length ? ` AND ${conds.join(' AND ')}` : '';

  try {
    // rejected 포함 전부 검색 대상(상태 필터는 호출부 UX에 위임). 소프트 삭제만 제외.
    const rows = await db.getAllAsync<Record<string, unknown> & { snippet: string }>(
      `SELECT d.*, snippet(decisions_fts, 1, '<m>', '</m>', ' … ', 20) AS snippet
       FROM decisions_fts
       JOIN decisions d ON d.id = decisions_fts.decision_id
       WHERE decisions_fts MATCH ?
         AND d.deleted_at IS NULL${extraWhere}
       ORDER BY d.extracted_at DESC
       LIMIT ?`,
      params,
    );
    return rows.map((r) => ({ decision: toDecision(r), snippet: r.snippet }));
  } catch (e) {
    // FTS5 파싱 오류(잘못된 쿼리 등) 시 빈 결과 반환 (searchTranscripts 선례 동일)
    console.warn('[search] decisions FTS5 query failed:', e);
    return [];
  }
}


// n년 전 오늘(같은 월-일, 과거 연도) 확정된 결정 — On-this-day 카드 (D4-c).
// getOnThisDay(entries) 패턴 그대로: strftime localtime 월-일 매칭(자정 하드코딩 없음, 코드 우선).
export async function getDecisionsOnThisDay(
  db: SQLiteDatabase,
  asOfMs: number,
  limit = 20,
): Promise<Decision[]> {
  const monthDay = format(new Date(asOfMs), 'MM-dd');
  const year = format(new Date(asOfMs), 'yyyy');
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM decisions
     WHERE deleted_at IS NULL AND status IN ('confirmed', 'edited')
       AND confirmed_at IS NOT NULL
       AND strftime('%m-%d', confirmed_at / 1000, 'unixepoch', 'localtime') = ?
       AND strftime('%Y', confirmed_at / 1000, 'unixepoch', 'localtime') < ?
     ORDER BY confirmed_at DESC LIMIT ?`,
    [monthDay, year, limit],
  );
  return rows.map(toDecision);
}


// E2(c): 최근 '결정 아님'으로 반려한 결정의 요약(user 우선) — 추출 프롬프트 캘리브레이션용.
export async function getRecentRejectedSummaries(
  db: SQLiteDatabase,
  limit = 8,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ summary: string }>(
    `SELECT COALESCE(user_summary, summary) AS summary
     FROM decisions
     WHERE status = 'rejected' AND deleted_at IS NULL
     ORDER BY extracted_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.summary);
}


// E3(b): 최근 N일 확정/수정 결정 요약(user 우선) + 결과 — compose/rewrite 맥락 주입용.
export interface DecisionDigestItem {
  summary: string;
  result: OutcomeResult | null;
}

export async function getRecentDecisionDigest(
  db: SQLiteDatabase,
  days = 7,
  limit = 10,
): Promise<DecisionDigestItem[]> {
  const since = nowMs() - days * 86_400_000;
  const rows = await db.getAllAsync<{ summary: string; result: string | null }>(
    `SELECT COALESCE(d.user_summary, d.summary) AS summary, o.result AS result
     FROM decisions d
     LEFT JOIN outcomes o ON o.decision_id = d.id AND o.deleted_at IS NULL
     WHERE d.deleted_at IS NULL AND d.status IN ('confirmed', 'edited')
       AND COALESCE(d.confirmed_at, d.extracted_at) >= ?
     ORDER BY COALESCE(d.confirmed_at, d.extracted_at) DESC
     LIMIT ?`,
    [since, limit],
  );
  return rows.map((r) => ({ summary: r.summary, result: r.result as OutcomeResult | null }));
}
