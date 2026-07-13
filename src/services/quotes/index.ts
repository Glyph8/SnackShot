import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getCachedQuote, upsertQuote } from '@/db';

import { dataPortalQuoteService } from './dataPortal';
import { twelveDataQuoteService } from './twelveData';
import type { QuoteService, SymbolHit } from './types';

export type { QuoteService } from './types';

// H6: 티커/쿼리 라우팅 — 6자리 숫자=KRX(공공데이터포털), 그 외=미국(Twelve Data).
//   핸들러·화면은 이 라우터만 보므로 무변경(라우터가 소스 차이를 흡수).
const isKrxTicker = (t: string) => /^\d{6}$/.test(t.trim());
const hasKorean = (q: string) => /[가-힣]/.test(q);

const routerQuoteService: QuoteService = {
  getDailyClose: (t, d) => (isKrxTicker(t) ? dataPortalQuoteService : twelveDataQuoteService).getDailyClose(t, d),
  getDailyCandles: (t, n) => (isKrxTicker(t) ? dataPortalQuoteService : twelveDataQuoteService).getDailyCandles(t, n),
  // 한글 포함 → KRX 전용(낭비 콜 방지). 그 외 → 두 소스 병행 후 KRX 먼저 합침.
  // 검색은 대화형 — "0건"과 "오류"를 구분한다: 한쪽 실패는 무시(부분 결과),
  // 양쪽 모두 실패하면 throw(화면이 '조회 실패'를 표시하도록).
  searchSymbols: async (q: string): Promise<SymbolHit[]> => {
    if (hasKorean(q)) return dataPortalQuoteService.searchSymbols(q);
    const settled = await Promise.allSettled([
      dataPortalQuoteService.searchSymbols(q),
      twelveDataQuoteService.searchSymbols(q),
    ]);
    const ok = settled.filter((s): s is PromiseFulfilledResult<SymbolHit[]> => s.status === 'fulfilled');
    if (ok.length === 0) {
      const reason = (settled[0] as PromiseRejectedResult).reason;
      throw reason instanceof Error ? reason : new Error('symbol search failed');
    }
    return ok.flatMap((s) => s.value).slice(0, 10);
  },
};

// QuoteService 팩토리 (ADR-008). H6 라우터(KRX + 미국).
let _instance: QuoteService | null = null;
export function getQuoteService(): QuoteService {
  if (!_instance) _instance = routerQuoteService;
  return _instance;
}

// 캐시 우선 일봉 종가. 캐시 히트 시 API 미호출. 실패·데이터 없음 시 null.
export async function getDailyCloseCached(
  db: SQLiteDatabase,
  ticker: string,
  dateMs: number,
): Promise<number | null> {
  const date = format(new Date(dateMs), 'yyyy-MM-dd');
  const cached = await getCachedQuote(db, ticker, date);
  if (cached != null) {
    console.log(`[quote] cache hit ${ticker} ${date}`);
    return cached;
  }
  const close = await getQuoteService().getDailyClose(ticker, dateMs);
  if (close != null) await upsertQuote(db, ticker, date, close);
  return close;
}
