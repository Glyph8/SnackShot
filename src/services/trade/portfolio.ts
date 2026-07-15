import { z } from 'zod';

// H3: 증권앱 캡처 → 보유 종목 파싱. Gemini 멀티모달 응답 스키마 + 산술 크로스체크.
// 안 보이는 값은 null이 정직한 출력(추정 금지) — quantity·avgPrice 등 전부 nullable.

export const HoldingSchema = z.object({
  name: z.string(),
  ticker: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  avgPrice: z.number().nullable().optional(),
  currentPrice: z.number().nullable().optional(),
  valuationAmount: z.number().nullable().optional(),
  purchaseAmount: z.number().nullable().optional(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const PortfolioParseSchema = z.object({
  holdings: z.array(HoldingSchema),
  asOf: z.string().nullable().optional(),
});
export type PortfolioParseResult = z.infer<typeof PortfolioParseSchema>;

// 확인 화면에서 다루는 편집 대상 — 파싱값 + needsReview 플래그.
export type ReviewedHolding = Holding & { needsReview: boolean };

// PortfolioSnapshot(저장 스냅샷). holdings는 사용자 확인 후 값.
export interface PortfolioSnapshot {
  id: string;
  createdAt: number;
  source: 'image' | 'manual';
  holdings: Holding[];
  /** I3: 원칙 상시 대조 캐시 JSON({ checkedAt, principlesHash, conflicts }). 파싱은 호출자 책임. */
  principleCheckJson?: string;
  deletedAt?: number;
}

const TOLERANCE = 0.02; // 2%

function offBy(a: number, b: number): boolean {
  if (b === 0) return a !== 0;
  return Math.abs(a - b) / Math.abs(b) > TOLERANCE;
}

// 산술 크로스체크(H3 핵심 안전장치, ADR-027 evidence 검증과 같은 철학 — 코드가 AI 출력을 검산).
//   |quantity×avgPrice − purchaseAmount| / purchaseAmount > 2%  또는
//   |quantity×currentPrice − valuationAmount| / valuationAmount > 2%  이면 needsReview.
// 해당 필드가 모두 있을 때만 검사(없으면 판정 보류 — needsReview는 값 누락이 아니라 불일치 신호).
export function flagHoldingReview(h: Holding): boolean {
  if (h.quantity != null && h.avgPrice != null && h.purchaseAmount != null) {
    if (offBy(h.quantity * h.avgPrice, h.purchaseAmount)) return true;
  }
  if (h.quantity != null && h.currentPrice != null && h.valuationAmount != null) {
    if (offBy(h.quantity * h.currentPrice, h.valuationAmount)) return true;
  }
  return false;
}

export function reviewHoldings(holdings: Holding[]): ReviewedHolding[] {
  return holdings.map((h) => ({ ...h, needsReview: flagHoldingReview(h) }));
}
