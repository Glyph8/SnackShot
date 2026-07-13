import { format } from 'date-fns';

import { getQuoteApiKey } from '@/lib/env';

import type { DailyCandle, QuoteService, SymbolHit } from './types';

// H4/H5 구현체: 공공데이터포털 금융위원회 주식시세정보(계좌 불필요, 서비스키만).
//   엔드포인트 getStockPriceInfo — 일봉(T+1 데이터, "현재가" 아님).
//   ⚠️ 정렬 비의존(H5b): 범위 조회 후 코드에서 srtnCd 정확 일치 + basDt 최대 행 선택.
//   응답 필드: srtnCd(단축코드6) · itmsNm(종목명) · basDt(기준일 yyyyMMdd) ·
//              mkp(시가) · clpr(종가) · hipr(고가) · lopr(저가). 숫자는 문자열로 온다.
//   인터페이스 뒤라 KIS 등으로 교체 자유(ADR-008).
//   실제 응답은 실기기+실키로 검증 필요(네트워크 제한 환경 미검증).

const ENDPOINT =
  'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo';
const TIMEOUT_MS = 15_000;
const DAY_MS = 86_400_000;

interface RawItem {
  srtnCd?: string; itmsNm?: string; basDt?: string;
  mkp?: string | number; clpr?: string | number; hipr?: string | number; lopr?: string | number;
}

function toNum(v: string | number | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

// 공통 조회.
//   기본(조용, H0): 실패·데이터 없음 시 빈 배열 — 백그라운드 경로(getDailyClose/Candles)용.
//   strict(대화형): 키 없음·HTTP·네트워크·파싱 실패를 throw — 사용자가 직접 누른 검색은
//   "0건"과 "오류"를 구분해 피드백해야 한다(0건만 빈 배열).
async function fetchItems(extra: Record<string, string>, opts?: { strict?: boolean }): Promise<RawItem[]> {
  const strict = opts?.strict === true;
  const key = await getQuoteApiKey();
  if (!key) {
    if (strict) throw new Error('[quote] 시세 API 키 없음');
    return [];
  }
  const params = new URLSearchParams({ serviceKey: key, resultType: 'json', pageNo: '1', ...extra });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[quote] HTTP ${res.status}`);
      if (strict) throw new Error(`[quote] HTTP ${res.status}`);
      return [];
    }
    const raw: unknown = await res.json();
    const items = (raw as { response?: { body?: { items?: { item?: unknown } } } })
      ?.response?.body?.items?.item;
    if (Array.isArray(items)) return items as RawItem[];
    return items ? [items as RawItem] : [];
  } catch (e) {
    console.warn('[quote] fetch failed', e);
    if (strict) throw e instanceof Error ? e : new Error(String(e));
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// H5b: 지정일(또는 직전 거래일) 종가. 범위 조회 → srtnCd 정확 필터 → basDt 최대.
async function getDailyClose(ticker: string, dateMs: number): Promise<number | null> {
  const items = await fetchItems({
    likeSrtnCd: ticker,
    beginBasDt: format(new Date(dateMs - 14 * DAY_MS), 'yyyyMMdd'),
    endBasDt: format(new Date(dateMs), 'yyyyMMdd'),
    numOfRows: '20',
  });
  const mine = items.filter((it) => it.srtnCd === ticker && it.basDt);
  if (mine.length === 0) return null;
  const latest = mine.reduce((a, b) => ((b.basDt ?? '') > (a.basDt ?? '') ? b : a));
  return toNum(latest.clpr);
}

// H5c: 과거→최근 오름차순 일봉. 휴장 여유로 days×1.6일 범위, numOfRows=days×2.
async function getDailyCandles(ticker: string, days: number): Promise<DailyCandle[]> {
  const span = Math.ceil(days * 1.6);
  const items = await fetchItems({
    likeSrtnCd: ticker,
    beginBasDt: format(new Date(Date.now() - span * DAY_MS), 'yyyyMMdd'),
    endBasDt: format(new Date(), 'yyyyMMdd'),
    numOfRows: String(days * 2),
  });
  const candles = items
    .filter((it) => it.srtnCd === ticker && it.basDt)
    .map((it): DailyCandle | null => {
      const close = toNum(it.clpr);
      if (close == null) return null;
      return {
        date: it.basDt as string,
        open: toNum(it.mkp) ?? close,
        close,
        high: toNum(it.hipr) ?? close,
        low: toNum(it.lopr) ?? close,
      };
    })
    .filter((c): c is DailyCandle => c != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return candles.slice(-days);
}

// H5c: 종목명 검색 — likeItmsNm. srtnCd로 dedupe(날짜별 여러 행 함정) → 상위 10.
async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const q = query.trim();
  if (!q) return [];
  const items = await fetchItems({ likeItmsNm: q, numOfRows: '40' }, { strict: true });
  const seen = new Set<string>();
  const hits: SymbolHit[] = [];
  for (const it of items) {
    const ticker = it.srtnCd;
    const name = it.itmsNm;
    if (!ticker || !name || seen.has(ticker)) continue;
    seen.add(ticker);
    hits.push({ ticker, name });
    if (hits.length >= 10) break;
  }
  return hits;
}

export const dataPortalQuoteService: QuoteService = { getDailyClose, getDailyCandles, searchSymbols };
