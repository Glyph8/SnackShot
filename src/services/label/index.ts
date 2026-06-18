import type { LabelService } from './types';
import { geminiLabelService } from './gemini';

export type { ExtractHints, DecisionCandidate, DecisionDraft, LabelResult, LabelService } from './types';

let _instance: LabelService | null = null;

/**
 * LabelService 팩토리 (ADR-008: 인터페이스로 추상화).
 * 현재는 항상 geminiLabelService(Gemini 2.5 Flash-Lite) 반환.
 */
export function getLabelService(): LabelService {
  if (!_instance) {
    _instance = geminiLabelService;
  }
  return _instance;
}
