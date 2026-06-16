/**
 * 도메인 enum 단일 진실원 (P1-2).
 *
 * 규칙:
 * - 각 enum은 `as const` 배열이 진실원. TS 유니온 타입은 배열에서 파생한다.
 * - Zod 검증은 `z.enum(X)`로 배열을 재사용 → 런타임 검증과 타입이 자동 일치.
 * - 신규(v8+) 마이그레이션의 CHECK 제약은 `sqlCheck()`로 생성한다.
 *   ⚠️ 기존 마이그레이션 SQL 텍스트는 append-only이므로 절대 수정하지 않는다(INV-migration-append).
 * - 새 값 추가는 여기 배열에 먼저 추가한 뒤, 파생물(타입·Zod·CHECK)을 사용한다.
 */

export const PROCESSING_STATUS = ['pending', 'processing', 'done', 'failed', 'skipped'] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUS)[number];

// text mode entry는 originalPath=''로 저장된다(파일 없음, ADR-003 노트 참조).
export const ENTRY_MODE = ['voice', 'silent', 'audio', 'text'] as const;
export type EntryMode = (typeof ENTRY_MODE)[number];

export const DECISION_STATUS = ['extracted', 'confirmed', 'rejected', 'edited'] as const;
export type DecisionStatus = (typeof DECISION_STATUS)[number];

export const DECISION_CATEGORY = ['investment', 'relationship', 'career', 'daily', 'other'] as const;
export type DecisionCategory = (typeof DECISION_CATEGORY)[number];

export const OUTCOME_RESULT = ['good', 'bad', 'mixed', 'unclear', 'skipped'] as const;
export type OutcomeResult = (typeof OUTCOME_RESULT)[number];

export const AI_JOB_TYPE = [
  'compression',
  'stt',
  'label_extraction',
  'outcome_followup',
  'obsidian_export',
] as const;
export type AiJobType = (typeof AI_JOB_TYPE)[number];

export const AI_JOB_STATUS = ['pending', 'running', 'done', 'failed', 'cancelled'] as const;
export type AiJobStatus = (typeof AI_JOB_STATUS)[number];

/**
 * 배열 값으로 SQLite CHECK 절을 생성한다 — 신규(v8+) 마이그레이션 전용.
 * 예: sqlCheck('mode', ENTRY_MODE) → "CHECK (mode IN ('voice','silent','audio','text'))"
 */
export function sqlCheck(column: string, values: readonly string[]): string {
  return `CHECK (${column} IN (${values.map((v) => `'${v}'`).join(',')}))`;
}

/**
 * 런타임 타입가드 팩토리. repo의 to*() 변환에서 `as` 단언 대신 사용 가능.
 * 예: const isEntryMode = makeGuard(ENTRY_MODE);
 */
export function makeGuard<T extends string>(values: readonly T[]) {
  const set = new Set<string>(values);
  return (x: unknown): x is T => typeof x === 'string' && set.has(x);
}
