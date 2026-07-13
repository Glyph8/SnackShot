import { z } from 'zod';

// H1/ADR-028 후속: 매매 결정의 정량 필드. decisions.structured_json에 JSON으로 보존.
// 의도적 작성(compose)·증권앱 캡처(H3)에서만 생성. 음성 추출 경로는 무변경(지어내기 방지).
// 파싱은 호출자 책임(safeParse) — 읽기 실패 시 무시(도메인 헤더 관례).

export const TradeDetailsSchema = z.object({
  kind: z.literal('trade'),
  name: z.string(),
  ticker: z.string().optional(),
  side: z.enum(['buy', 'sell', 'hold']),
  amountKrw: z.number().optional(),
  quantity: z.number().optional(),
  entryPrice: z.number().optional(),
  targetPrice: z.number().optional(),
  stopPrice: z.number().optional(),
  eventTrigger: z.string().optional(),
  priceAtDecision: z.number().optional(),
});

export type TradeDetails = z.infer<typeof TradeDetailsSchema>;

export const SIDE_LABEL: Record<TradeDetails['side'], string> = {
  buy: '매수',
  sell: '매도',
  hold: '보류',
};

/** structured_json 컬럼 문자열 → TradeDetails. 파싱/검증 실패 시 null. */
export function parseTradeDetails(json: string | null | undefined): TradeDetails | null {
  if (!json) return null;
  try {
    const parsed = TradeDetailsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function num(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 상세 화면 표시용 여러 줄 문자열(값 있는 필드만). */
export function formatTradeDetails(td: TradeDetails): string {
  const lines: string[] = [`${td.name}${td.ticker ? ` (${td.ticker})` : ''} · ${SIDE_LABEL[td.side]}`];
  if (td.amountKrw != null) lines.push(`금액 ${num(td.amountKrw)}원`);
  if (td.quantity != null) lines.push(`수량 ${num(td.quantity)}`);
  if (td.entryPrice != null) lines.push(`진입가 ${num(td.entryPrice)}`);
  if (td.targetPrice != null) lines.push(`목표가 ${num(td.targetPrice)}`);
  if (td.stopPrice != null) lines.push(`손절가 ${num(td.stopPrice)}`);
  if (td.eventTrigger) lines.push(`이벤트: ${td.eventTrigger}`);
  if (td.priceAtDecision != null) lines.push(`결정시 종가 ${num(td.priceAtDecision)}`);
  return lines.join('\n');
}

/** 옵시디언 export 콜아웃용 라인(값 있는 필드만, `> ` 접두사는 호출부). */
export function tradeExportLines(td: TradeDetails): string[] {
  const parts: string[] = [`${td.name}${td.ticker ? ` (${td.ticker})` : ''} ${SIDE_LABEL[td.side]}`];
  if (td.amountKrw != null) parts.push(`금액 ${num(td.amountKrw)}원`);
  if (td.quantity != null) parts.push(`수량 ${num(td.quantity)}`);
  if (td.entryPrice != null) parts.push(`진입가 ${num(td.entryPrice)}`);
  if (td.targetPrice != null) parts.push(`목표가 ${num(td.targetPrice)}`);
  if (td.stopPrice != null) parts.push(`손절가 ${num(td.stopPrice)}`);
  if (td.priceAtDecision != null) parts.push(`결정시 종가 ${num(td.priceAtDecision)}`);
  const lines = [`> **매매**: ${parts.join(' · ')}`];
  if (td.eventTrigger) lines.push(`> **이벤트 대기**: ${td.eventTrigger}`);
  return lines;
}
