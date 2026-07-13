import type { DecisionCategory } from '@/types/domain';
import type { DecisionDigestItem } from '@/db';
import type { PortfolioParseResult, PortfolioSnapshot } from '@/services/trade/portfolio';
import type { TradeDetails } from '@/services/trade/schema';

export interface ExtractHints {
  userDecisionHint: boolean;
  recordedAtIso: string;
  durationSec: number;
  // E2(c): 사용자가 과거 '결정 아님'으로 반려한 요약들(개인화 캘리브레이션 — systemInstruction 동적 주입).
  recentRejectedSummaries?: string[];
  // E3(a): 사용자 프로필(Profile.md) — 추출 systemInstruction 참고 맥락.
  userProfile?: string;
}

// E3: compose/rewrite에 주입하는 개인화 맥락(프로필 + 최근 결정 다이제스트).
export interface AiContext {
  profile?: string;
  recentDigest?: DecisionDigestItem[];
  // F2(b): 과거 유사 결정에서 추린 교훈 — compose 경로에서만 세팅(추출/rewrite는 미세팅→자연 제외).
  relevantLearnings?: string[];
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
// G1(a): 입력에 근거가 없는 필드는 null — 화면에서 사용자가 직접 채운다("모름의 출구").
export interface DecisionDraft {
  summary: string;
  category: DecisionCategory;
  situation: string | null;
  alternatives: string | null;
  reasoning: string | null;
  expectedOutcome: string | null;
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
  composeDecision(input: string, context?: AiContext): Promise<DecisionDraft>;
  // 원본 텍스트 + 지침 → 교정된 텍스트(plain string) (v10)
  rewriteText(input: RewriteInput, context?: AiContext): Promise<string>;
  // H3: 증권앱 캡처(이미지 base64) → 보유 종목 파싱(멀티모달)
  parsePortfolioImage(imageBase64: string, mimeType: string): Promise<PortfolioParseResult>;
  // H2: 매매 원칙(Profile.md) 대조 — 충돌만 반환(추천·전망 금지)
  checkPrinciples(input: PrincipleCheckInput): Promise<PrincipleConflict[]>;
  getEngineInfo(): { name: string; version: string };
}

export interface PrincipleConflict { rule: string; issue: string; }

export interface PrincipleCheckInput {
  summary: string;
  situation?: string;
  reasoning?: string;
  tradeDetails: TradeDetails;
  principles: string;
  portfolio?: PortfolioSnapshot | null;
}
