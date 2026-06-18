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

export interface LabelService {
  extractDecisions(transcript: string, hints: ExtractHints): Promise<LabelResult>;
  getEngineInfo(): { name: string; version: string };
}
