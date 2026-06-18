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

export interface LabelService {
  extractDecisions(transcript: string, hints: ExtractHints): Promise<LabelResult>;
  composeDecision(input: string): Promise<DecisionDraft>;
  getEngineInfo(): { name: string; version: string };
}
