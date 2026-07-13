// H4: 시세 서비스 인터페이스 (ADR-002/008 패턴 — 구현체 교체 자유).
// 범위: 일봉 종가만. 실시간·호가·차트 없음(앱 성격 이탈 방지, H4 확정).

export interface DailyCandle {
  date: string; // yyyyMMdd
  open: number;
  close: number;
  high: number;
  low: number;
}

export interface SymbolHit {
  ticker: string;
  name: string;
  exchange?: string;
}

export interface QuoteService {
  /**
   * 지정일(또는 직전 거래일)의 종가. 데이터 없음·키 미설정·실패 시 null.
   * @param ticker 6자리 종목코드
   * @param dateMs 기준 시각(UTC ms). 해당일이 휴장이면 직전 거래일 종가.
   */
  getDailyClose(ticker: string, dateMs: number): Promise<number | null>;
  /** 과거→최근 오름차순 일봉(H5). 실패 시 빈 배열. */
  getDailyCandles(ticker: string, days: number): Promise<DailyCandle[]>;
  /** 종목명 검색(H5). 결과 없음 = 빈 배열, 조회 실패 = throw(대화형 — 0건과 오류를 구분). */
  searchSymbols(query: string): Promise<SymbolHit[]>;
}
