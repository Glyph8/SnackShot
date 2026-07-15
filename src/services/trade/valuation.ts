import type { SQLiteDatabase } from 'expo-sqlite';

import { nowMs } from '@/lib/time';
import { getDailyCloseCached } from '@/services/quotes';
import type { PortfolioSnapshot } from '@/services/trade/portfolio';

// I3(c)1: 포트폴리오 평가액 = Σ(quantity × 최신 종가).
//   종목별 getDailyCloseCached(오늘 기준, T+1이라 직전 영업일) 캐시 우선 조회,
//   시세 실패 종목은 valuationAmount(캡처값) 폴백, 그것도 없으면 제외 + missingNames로 캡션 안내.

export interface PortfolioValuation {
  total: number;
  /** 시세·캡처 평가값이 모두 없어 합계에서 제외된 종목명 */
  missingNames: string[];
}

export async function computePortfolioValuation(
  db: SQLiteDatabase,
  snapshot: PortfolioSnapshot,
): Promise<PortfolioValuation> {
  let total = 0;
  const missingNames: string[] = [];
  for (const h of snapshot.holdings) {
    let value: number | null = null;
    if (h.ticker && h.quantity != null) {
      const close = await getDailyCloseCached(db, h.ticker, nowMs());
      if (close != null) value = close * h.quantity;
    }
    if (value == null && h.valuationAmount != null) value = h.valuationAmount;
    if (value == null) { missingNames.push(h.name); continue; }
    total += value;
  }
  return { total, missingNames };
}
