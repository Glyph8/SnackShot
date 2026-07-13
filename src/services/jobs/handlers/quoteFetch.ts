import type { SQLiteDatabase } from 'expo-sqlite';

import { getDecision, updateDecisionStructuredJson } from '@/db';
import { getQuoteApiKey } from '@/lib/env';
import { getDailyCloseCached } from '@/services/quotes';
import { parseTradeDetails } from '@/services/trade/schema';
import type { AiJob } from '@/types/domain';

/**
 * H4: 매매 결정의 결정 시점 종가(priceAtDecision)를 조회해 structured_json에 기입한다.
 * payload: { ticker, date }.
 *
 * H0/H4: 시세는 optional 경로 — 키 미설정·티커 없음·데이터 없음·API 실패는 전부 조용히 종료(치명 아님).
 * priceAtDecision이 이미 있으면 덮어쓰지 않는다(멱등).
 */
export async function handleQuoteFetch(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const key = await getQuoteApiKey();
  if (!key) {
    console.log('[quote] API 키 없음 → skip');
    return;
  }

  let ticker: string | undefined;
  let dateMs: number | undefined;
  try {
    const payload = job.payloadJson ? JSON.parse(job.payloadJson) : {};
    ticker = typeof payload.ticker === 'string' ? payload.ticker : undefined;
    dateMs = typeof payload.date === 'number' ? payload.date : undefined;
  } catch {
    /* 잘못된 payload → skip */
  }
  if (!ticker || dateMs == null) {
    console.log('[quote] ticker/date 없음 → skip');
    return;
  }

  const close = await getDailyCloseCached(db, ticker, dateMs);
  if (close == null) {
    console.log(`[quote] 시세 없음 ${ticker} → skip`);
    return;
  }

  const decision = await getDecision(db, job.targetId);
  if (!decision) return;
  const td = parseTradeDetails(decision.structuredJson);
  if (!td || td.priceAtDecision != null) return; // 매매 아님 or 이미 기입됨

  await updateDecisionStructuredJson(db, job.targetId, JSON.stringify({ ...td, priceAtDecision: close }));
  console.log(`[quote] priceAtDecision=${close} 기입 id=${job.targetId}`);
}
