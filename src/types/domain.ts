/**
 * 도메인 타입 정의 (ADR-003 ~ ADR-017).
 * - 모든 시각: UTC Unix ms (ADR-013)
 * - 모든 ID: ULID 문자열 (ADR-009)
 * - nullable은 `T | undefined`로 표현 — repo에서 DB NULL → undefined 변환
 * - JSON 컬럼은 string으로 보존, 파싱은 호출자 책임
 */

// ───────── enum 단일 진실원 (P1-2): src/types/enums.ts ─────────
export {
  PROCESSING_STATUS, ENTRY_MODE, DECISION_STATUS, DECISION_CATEGORY,
  OUTCOME_RESULT, AI_JOB_TYPE, AI_JOB_STATUS, DECISION_ORIGIN,
  TEXT_REVISION_KIND, TEXT_REVISION_SOURCE,
} from './enums';
export type {
  ProcessingStatus, EntryMode, DecisionStatus, DecisionCategory,
  OutcomeResult, AiJobType, AiJobStatus, DecisionOrigin,
  TextRevisionKind, TextRevisionSource,
} from './enums';
import type {
  ProcessingStatus, EntryMode, DecisionStatus, DecisionCategory,
  OutcomeResult, AiJobType, AiJobStatus, DecisionOrigin,
  TextRevisionKind, TextRevisionSource,
} from './enums';

// ───────── 공통 ─────────


// ───────── Entry (클립 — 1급 객체, ADR-003) ─────────

// text mode entry는 originalPath=''로 저장된다(파일 없음, ADR-003 노트 참조).

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
  // ── 영상 관리 (v11) ──
  // 달성한 압축 단계: 0=원본만, 1=기본, 2/3=심화. 부분 SELECT 재사용 호환 위해 optional(없으면 0 취급).
  compressionLevel?: number;
  originalBackedUpAt?: number;  // 원본 외부 백업 완료 시각
  originalPurgedAt?: number;    // 백업 후 로컬 원본 삭제 시각
  backupUri?: string;           // 백업 위치(표시용)
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



export interface Decision {
  id: string;
  entryId: string;
  // AI 원본 (ADR-016 — 보존)
  summary: string;
  category: DecisionCategory;
  customCategory?: string;   // 사용자 커스텀 카테고리 라벨(있으면 표시 우선) — v9
  situation?: string;        // 상황(맥락) — v8
  reasoning?: string;
  alternatives?: string;
  expectedOutcome?: string;
  evidenceQuote?: string;
  confidence: number;
  // 사용자 편집본 (ADR-016 — 별도 컬럼)
  userSummary?: string;
  userCategory?: DecisionCategory;
  userSituation?: string;    // 상황 편집본 — v8
  userReasoning?: string;
  // 상태/메타
  status: DecisionStatus;
  origin: DecisionOrigin;    // 출처(자동 발굴/의도적 작성) — v8
  followUpAt?: number;
  followUpSetBy?: string;
  extractedAt: number;
  confirmedAt?: number;
  executedAt?: number;       // 수행 완료 시각(null=활성 todo) — v8
  aiEngine: string;
  tagsJson?: string;
  deletedAt?: number;
}

// ───────── Outcome (결정의 결과) ─────────


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

// ───────── TextRevision (텍스트 버전 로그 — v10, 다단계 롤백) ─────────
// 전사(transcript.text)·결정(summary/situation/reasoning)의 변경 이력.
// field: kind=transcript이면 'text', kind=decision이면 편집 대상 필드명.
// content: 그 시점의 텍스트 값. instruction: AI 재작성 시 사용자가 준 지침(있을 때만).
export interface TextRevision {
  id: string;
  targetKind: TextRevisionKind;
  targetId: string;
  field: string;
  content: string;
  source: TextRevisionSource;
  instruction?: string;
  createdAt: number;
}

// ───────── AiJob (백그라운드 큐 — ADR-012) ─────────



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
