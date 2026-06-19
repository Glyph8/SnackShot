import type { DecisionCategory } from '@/types/domain';

export interface ExtractHints {
  userDecisionHint: boolean;
  recordedAtIso: string;
  durationSec: number;
}

export interface DecisionCandidate {
  summary: string;
  category: DecisionCategory;
  situation: string;
  reasoning: string;
  alternatives: string;
  expectedOutcome: string;
  evidence: string;
  confidence: number;
  followUpAfterDays: number | null;
}

export interface LabelResult {
  hasDecision: boolean;
  candidates: DecisionCandidate[];
}

// 의도적 작성 — 키워드/짧은 메모를 구조화된 결정 한 건으로 확장한 초안 (v8 Phase 3).
// 사용자 검토·수정 후 confirmed/authored로 저장된다. evidence/confidence는 없음(전사 아님).
export interface DecisionDraft {
  summary: string;
  category: DecisionCategory;
  situation: string;
  alternatives: string;
  reasoning: string;
  expectedOutcome: string;
  followUpAfterDays: number | null;
}

// 텍스트 재작성 입력 (v10) — 원본 한 필드를 사용자 지침대로 교정.
//   targetLabel: 프롬프트에 줄 사람이 읽는 대상 설명(예: '음성 전사(STT)', '의사결정 요약').
export interface RewriteInput {
  targetLabel: string;
  original: string;
  instruction: string;
}

export interface LabelService {
  extractDecisions(transcript: string, hints: ExtractHints): Promise<LabelResult>;
  composeDecision(input: string): Promise<DecisionDraft>;
  // 원본 텍스트 + 지침 → 교정된 텍스트(plain string) (v10)
  rewriteText(input: RewriteInput): Promise<string>;
  getEngineInfo(): { name: string; version: string };
}
