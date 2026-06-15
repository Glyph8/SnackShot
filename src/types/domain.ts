/**
 * 도메인 타입 정의 (ADR-003 ~ ADR-017).
 * - 모든 시각: UTC Unix ms (ADR-013)
 * - 모든 ID: ULID 문자열 (ADR-009)
 * - nullable은 `T | undefined`로 표현 — repo에서 DB NULL → undefined 변환
 * - JSON 컬럼은 string으로 보존, 파싱은 호출자 책임
 */

// ───────── 공통 ─────────

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'done'
  | 'failed'
  | 'skipped';

// ───────── Entry (클립 — 1급 객체, ADR-003) ─────────

// text mode entry는 originalPath=''로 저장된다(파일 없음, ADR-003 노트 참조).
export type EntryMode = 'voice' | 'silent' | 'audio' | 'text';

export interface Entry {
  id: string;
  createdAt: number;
  recordedAt: number;
  originalPath: string;
  compressedPath?: string;
  thumbnailPath?: string;
  durationMs: number;
  mode: EntryMode;
  manualNote?: string;
  compressionStatus: ProcessingStatus;
  aiLabelStatus: ProcessingStatus;
  sttStatus: ProcessingStatus;
  metadataJson?: string;
  // ADR-006: 녹화 직후 사용자가 "중요 결정 포함" 토글을 눌렀는지.
  // 누르지 않으면 false (AI 판단에 위임).
  userDecisionHint: boolean;
  exportedAt?: number;
  deletedAt?: number;
}

// ───────── Transcript (별도 테이블, 1:N — ADR-010) ─────────

export interface Transcript {
  id: string;
  entryId: string;
  rawText: string;
  editedText?: string;
  engine: string;
  engineVersion?: string;
  language: string;
  confidence?: number;
  segmentsJson?: string;
  createdAt: number;
}

// ───────── Decision (ADR-006 ~ 008, 016) ─────────

export type DecisionStatus =
  | 'extracted'
  | 'confirmed'
  | 'rejected'
  | 'edited';

export type DecisionCategory =
  | 'investment'
  | 'relationship'
  | 'career'
  | 'daily'
  | 'other';

export interface Decision {
  id: string;
  entryId: string;
  // AI 원본 (ADR-016 — 보존)
  summary: string;
  category: DecisionCategory;
  reasoning?: string;
  alternatives?: string;
  expectedOutcome?: string;
  evidenceQuote?: string;
  confidence: number;
  // 사용자 편집본 (ADR-016 — 별도 컬럼)
  userSummary?: string;
  userCategory?: DecisionCategory;
  userReasoning?: string;
  // 상태/메타
  status: DecisionStatus;
  followUpAt?: number;
  followUpSetBy?: string;
  extractedAt: number;
  confirmedAt?: number;
  aiEngine: string;
  tagsJson?: string;
  deletedAt?: number;
}

// ───────── Outcome (결정의 결과) ─────────

export type OutcomeResult =
  | 'good'
  | 'bad'
  | 'mixed'
  | 'unclear'
  | 'skipped';

export interface Outcome {
  id: string;
  decisionId: string;
  entryId?: string;
  result: OutcomeResult;
  reflection?: string;
  learnings?: string;
  aiEngine?: string;
  createdAt: number;
  deletedAt?: number;
}

// ───────── AiJob (백그라운드 큐 — ADR-012) ─────────

export type AiJobType =
  | 'compression'
  | 'stt'
  | 'label_extraction'
  | 'outcome_followup'
  | 'obsidian_export';

export type AiJobStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface AiJob {
  id: string;
  jobType: AiJobType;
  targetId: string;
  targetTable: string;
  status: AiJobStatus;
  attempts: number;
  lastError?: string;
  scheduledAt: number;
  startedAt?: number;
  completedAt?: number;
  payloadJson?: string;
}
