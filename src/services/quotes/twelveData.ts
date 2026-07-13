import { format } from 'date-fns';

import { getTwelveDataKey } from '@/lib/env';

import type { DailyCandle, QuoteService, SymbolHit } from './types';

// H6 구현체: Twelve Data(미국 주식 일봉). 무료 800크레딧/일·8콜/분.
//   ⚠️ 함정(확정): ① 오류도 HTTP 200 — body status==='error' 검사 → null/빈 배열(조용, H0).
//                  ② 숫자 필드가 문자열 — parseFloat. ③ 한도 초과도 조용히 skip.
//   ⚠️ 엔드포인트·응답 형태는 실기기+실키+공식문서로 검증 필요(네트워크 제한 환경 미검증).

const BASE = 'https://api.twelvedata.com';
const TIMEOUT_MS = 15_000;

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

// 공통 호출 — 기본: 키 없음·네트워크 실패·status:error(HTTP 200 오류 포함)면 null(조용, H0).
//   strict(대화형): 위 실패를 throw — 검색은 "0건"과 "오류"를 구분해 피드백(0건만 빈 결과).
async function tdFetch(path: string, params: Record<string, string>, opts?: { strict?: boolean }): Promise<unknown | null> {
  const strict = opts?.strict === true;
  const key = await getTwelveDataKey();
  if (!key) {
    if (strict) throw new Error('[twelve] API 키 없음');
    return null;
  }
  const url = `${BASE}/${path}?${new URLSearchParams({ ...params, apikey: key }).toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[twelve] HTTP ${res.status}`);
      if (strict) throw new Error(`[twelve] HTTP ${res.status}`);
      return null;
    }
    const raw: unknown = await res.json();
    // 함정 ①/③: 오류·한도 초과도 HTTP 200 + { status:'error', code, message }
    if (raw && typeof raw === 'object' && (raw as { status?: string }).status === 'error') {
      const e = raw as { code?: number; message?: string };
      console.warn(`[twelve] error ${e.code}: ${e.message}`);
      if (strict) throw new Error(`[twelve] ${e.code}: ${e.message ?? 'error'}`);
      return null;
    }
    return raw;
  } catch (e) {
    console.warn('[twelve] fetch failed', e);
    if (strict) throw e instanceof Error ? e : new Error(String(e));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface TdValue { datetime?: string; open?: string; high?: string; low?: string; close?: string }

async function getDailyClose(ticker: string, dateMs: number): Promise<number | null> {
  const raw = await tdFetch('time_series', {
    symbol: ticker, interval: '1day', outputsize: '1', end_date: format(new Date(dateMs), 'yyyy-MM-dd'),
  });
  const values = (raw as { values?: TdValue[] } | null)?.values;
  return values && values.length ? toNum(values[0].close) : null;
}

async function getDailyCandles(ticker: string, days: number): Promise<DailyCandle[]> {
  const raw = await tdFetch('time_series', {
    symbol: ticker, interval: '1day', outputsize: String(days),
  });
  const values = (raw as { values?: TdValue[] } | null)?.values ?? [];
  return values
    .map((v): DailyCandle | null => {
      const close = toNum(v.close);
      if (close == null || !v.datetime) return null;
      // datetime 'yyyy-MM-dd' → 'yyyyMMdd'로 통일(KRX와 동일 형식)
      const date = v.datetime.replace(/-/g, '').slice(0, 8);
      return { date, open: toNum(v.open) ?? close, close, high: toNum(v.high) ?? close, low: toNum(v.low) ?? close };
    })
    .filter((c): c is DailyCandle => c != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface TdSymbol { symbol?: string; instrument_name?: string; exchange?: string }

async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const q = query.trim();
  if (!q) return [];
  const raw = await tdFetch('symbol_search', { symbol: q }, { strict: true });
  const data = (raw as { data?: TdSymbol[] } | null)?.data ?? [];
  const hits: SymbolHit[] = [];
  for (const d of data) {
    if (!d.symbol || !d.instrument_name) continue;
    hits.push({ ticker: d.symbol, name: d.instrument_name, exchange: d.exchange });
    if (hits.length >= 10) break;
  }
  return hits;
}

export const twelveDataQuoteService: QuoteService = { getDailyClose, getDailyCandles, searchSymbols };
