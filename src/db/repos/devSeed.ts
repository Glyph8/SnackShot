import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';

import { insertDecision } from './decisions';
import { insertDecisionLink } from './decisionLinks';
import { insertOutcome } from './outcomes';
import { upsertQuote } from './quotes';

// ⚠️ 개발/테스트 전용 — 시드 데이터 삽입·제거. 릴리스에서는 DevToolsSection(__DEV__) 뒤에 숨는다.
// 시드 행은 모두 마커로 표시해 안전하게 일괄 제거한다:
//   entries.metadata_json 에 "__seed__", decisions/outcomes.ai_engine='__seed__', decision_links.note='__seed__',
//   portfolio_snapshots.holdings_json 각 항목에 "__seed__"(HoldingSchema가 여분 키를 strip — 화면 무영향),
//   quotes는 시드 티커 행 삭제(캐시라 실데이터가 지워져도 재조회로 복구 — 무해).

export const SEED_MARKER = '__seed__';

export interface SeedResult {
  entries: number; decisions: number; outcomes: number; links: number;
  /** 주식 시드(I3 검증용) — 매매 결정/스냅샷/quotes 캐시 행 수 */
  trades?: number; snapshots?: number; quotes?: number;
}

const DAY = 86_400_000;

function yearsAgo(now: number, n: number): number {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - n);
  return d.getTime();
}

async function insertSeedEntry(db: SQLiteDatabase, id: string, recordedAt: number, note: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO entries
       (id, created_at, recorded_at, original_path, duration_ms, mode,
        compression_status, ai_label_status, manual_note, metadata_json)
     VALUES (?, ?, ?, '', 0, 'text', 'skipped', 'skipped', ?, ?)`,
    [id, recordedAt, recordedAt, note, JSON.stringify({ __seed__: true })],
  );
}

/** 과거 날짜 결정 + 회고 + 링크 + 후속알림 후보를 삽입해 D1~D4를 즉시 확인 가능하게 한다. */
export async function seedTestData(db: SQLiteDatabase): Promise<SeedResult> {
  const now = nowMs();
  const entryId = newId();
  await insertSeedEntry(db, entryId, now, '[테스트] 시드 엔트리');

  interface Over {
    summary: string; category: string; confidence: number; status?: string;
    confirmedAt?: number; executedAt?: number; extractedAt?: number;
    expectedOutcome?: string; situation?: string; reasoning?: string;
    followUpAt?: number; customCategory?: string; decideBy?: number;
    structuredJson?: string;
  }
  const mk = (o: Over) => insertDecision(db, {
    entryId,
    summary: o.summary,
    category: o.category as never, // 시드 전용 — 문자열을 도메인 enum으로 취급
    confidence: o.confidence,
    status: (o.status ?? 'confirmed') as never,
    origin: 'authored',
    extractedAt: o.extractedAt ?? o.confirmedAt ?? now,
    confirmedAt: o.confirmedAt,
    executedAt: o.executedAt,
    expectedOutcome: o.expectedOutcome,
    situation: o.situation,
    reasoning: o.reasoning,
    followUpAt: o.followUpAt,
    followUpSetBy: o.followUpAt != null ? 'user' : undefined,
    customCategory: o.customCategory,
    decideBy: o.decideBy,
    structuredJson: o.structuredJson,
    aiEngine: SEED_MARKER,
  });

  // 작년/재작년 오늘 → On-this-day
  const dTy1 = await mk({
    summary: '[테스트] 이직 결정', category: 'career', confidence: 0.9,
    confirmedAt: yearsAgo(now, 1), executedAt: yearsAgo(now, 1) + 3 * DAY,
    situation: '지금 회사가 정체됨', reasoning: '더 큰 성장 기회', expectedOutcome: '연봉·역량 상승',
  });
  await insertOutcome(db, { decisionId: dTy1.id, result: 'good', reflection: '잘한 선택', learnings: '초기 연봉 협상이 중요', aiEngine: SEED_MARKER });

  const dTy2 = await mk({
    summary: '[테스트] 부동산 투자', category: 'investment', confidence: 0.5,
    confirmedAt: yearsAgo(now, 2), executedAt: yearsAgo(now, 2) + 10 * DAY,
  });
  await insertOutcome(db, { decisionId: dTy2.id, result: 'bad', reflection: '타이밍이 나빴다', aiEngine: SEED_MARKER });

  // 올해(최근) — 통계·calibration·연관결정
  const dNow1 = await mk({
    summary: '[테스트] 관계 정리', category: 'relationship', confidence: 0.7,
    confirmedAt: now - 20 * DAY, executedAt: now - 15 * DAY, reasoning: '가치관 차이',
  });
  await insertOutcome(db, { decisionId: dNow1.id, result: 'mixed', learnings: '대화가 더 필요했다', aiEngine: SEED_MARKER });

  await mk({
    summary: '[테스트] 커스텀 카테고리 결정', category: 'other', customCategory: '이사',
    confidence: 0.65, confirmedAt: now - 5 * DAY, executedAt: now - 2 * DAY,
  });

  // 후속 확인 알림 후보(2분 뒤) + '당시 기대' 블록용 expectedOutcome, 회고 없음
  await mk({
    summary: '[테스트] 헬스 PT 등록', category: 'daily', confidence: 0.85,
    confirmedAt: now - DAY, expectedOutcome: '주 3회 운동 습관화', followUpAt: now + 2 * 60 * 1000,
  });

  // 검토 대기(덱)
  await mk({ summary: '[테스트] 검토 대기 결정', category: 'daily', confidence: 0.6, status: 'extracted', extractedAt: now });

  // 미결(deliberating) — 마감 임박(D-2, 알림 예약) + 마감 경과(강조) (F5/ADR-028)
  await mk({
    summary: '[테스트] 미결 · 실적 발표 후 매수', category: 'investment', confidence: 0.5,
    status: 'deliberating', extractedAt: now - DAY, decideBy: now + 2 * DAY,
    situation: '실적 발표 대기 중 — 사거나 말거나',
  });
  await mk({
    summary: '[테스트] 미결 · 마감 지남', category: 'daily', confidence: 0.5,
    status: 'deliberating', extractedAt: now - 10 * DAY, decideBy: now - DAY,
  });

  // ── 주식 시드(I3 — 투자 탭·종목 차트 마커·평가액·등락 검증) ──────────────
  // 실존 티커(005930)를 쓰면 시세 키가 있을 때 실제 일봉 차트 위에 시드 마커가 얹힌다.
  // 차트(getDailyCandles)는 캐시를 쓰지 않으므로 오프라인에선 차트 없이 리스트만 보인다.
  const trade = (o: object) => JSON.stringify({ kind: 'trade', ...o });

  const dBuy = await mk({
    summary: '[테스트] 삼성전자 분할 매수 시작', category: 'investment', confidence: 0.8,
    confirmedAt: now - 35 * DAY, executedAt: now - 34 * DAY,
    situation: '조정장에서 분할 진입', reasoning: '한 번에 사면 마음이 흔들림',
    expectedOutcome: '평단 관리하며 목표가 도달',
    structuredJson: trade({ name: '삼성전자', ticker: '005930', side: 'buy', quantity: 10, entryPrice: 65000, priceAtDecision: 65000, targetPrice: 78000, stopPrice: 60000 }),
  });
  await insertOutcome(db, { decisionId: dBuy.id, result: 'good', learnings: '분할 매수가 마음이 편했다', aiEngine: SEED_MARKER });

  const dSell = await mk({
    summary: '[테스트] 삼성전자 절반 익절', category: 'investment', confidence: 0.75,
    confirmedAt: now - 10 * DAY, executedAt: now - 9 * DAY,
    reasoning: '목표가 근접, 원칙대로 절반 정리',
    structuredJson: trade({ name: '삼성전자', ticker: '005930', side: 'sell', quantity: 5, entryPrice: 72000, priceAtDecision: 72000 }),
  });
  await insertOutcome(db, { decisionId: dSell.id, result: 'good', reflection: '원칙대로 익절', aiEngine: SEED_MARKER });

  // 미결 매매(이벤트 대기) — 종목 차트 우측 ◇ 점선 + 투자 탭 미결 카운트
  await mk({
    summary: '[테스트] 미결 · AAPL 실적 보고 매수', category: 'investment', confidence: 0.5,
    status: 'deliberating', extractedAt: now - 2 * DAY, decideBy: now + 5 * DAY,
    structuredJson: trade({ name: 'Apple', ticker: 'AAPL', side: 'buy', eventTrigger: '실적 발표' }),
  });

  // 포트폴리오 스냅샷(수동) — 각 holding에 __seed__ 키(HoldingSchema strip → 화면 무영향, purge 식별용).
  // 카카오는 비중을 크게 잡아 원칙("단일 종목 20% 이하" 류) 충돌 테스트 소재.
  const snapshotId = newId();
  await db.runAsync(
    `INSERT INTO portfolio_snapshots (id, created_at, source, holdings_json) VALUES (?, ?, 'manual', ?)`,
    [snapshotId, now, JSON.stringify([
      { __seed__: true, name: '삼성전자', ticker: '005930', quantity: 10, avgPrice: 65000, valuationAmount: 728000 },
      { __seed__: true, name: 'Apple', ticker: 'AAPL', quantity: 5, avgPrice: 180, valuationAmount: 1140 },
      { __seed__: true, name: '카카오', ticker: '035720', quantity: 30, avgPrice: 52000, valuationAmount: 1386000 },
    ])],
  );

  // quotes 캐시(오늘·어제) — 평가액·시세 대조·등락이 오프라인에서도 동작하도록.
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10); // yyyy-MM-dd (getDailyCloseCached 키 형식)
  await upsertQuote(db, '005930', day(now), 72800);
  await upsertQuote(db, '005930', day(now - DAY), 72000);
  await upsertQuote(db, 'AAPL', day(now), 228.5);
  await upsertQuote(db, 'AAPL', day(now - DAY), 231.2);
  await upsertQuote(db, '035720', day(now), 46200);

  // 연관 결정
  await insertDecisionLink(db, { fromDecisionId: dTy1.id, toDecisionId: dNow1.id, linkType: 'similar', note: SEED_MARKER });

  return { entries: 1, decisions: 12, outcomes: 5, links: 1, trades: 3, snapshots: 1, quotes: 5 };
}

export interface PurgeResult { decisions: number; entries: number }

/** 시드 데이터 일괄 제거(하드 delete). FTS 가상테이블 잔여행도 함께 정리. */
export async function purgeTestData(db: SQLiteDatabase): Promise<PurgeResult> {
  const dc = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM decisions WHERE ai_engine = ?`, [SEED_MARKER],
  );
  const ec = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM entries WHERE metadata_json LIKE '%"__seed__"%'`,
  );

  // 하드 DELETE에는 FTS 정리 트리거가 없으므로(soft-delete 트리거만 존재) 수동 정리.
  await db.runAsync(
    `DELETE FROM decisions_fts WHERE decision_id IN (SELECT id FROM decisions WHERE ai_engine = ?)`,
    [SEED_MARKER],
  );
  await db.runAsync(
    `DELETE FROM transcripts_fts WHERE entry_id IN (SELECT id FROM entries WHERE metadata_json LIKE '%"__seed__"%')`,
  );
  await db.runAsync(`DELETE FROM decision_links WHERE note = ?`, [SEED_MARKER]);
  await db.runAsync(`DELETE FROM outcomes WHERE ai_engine = ?`, [SEED_MARKER]);
  await db.runAsync(`DELETE FROM decisions WHERE ai_engine = ?`, [SEED_MARKER]);
  await db.runAsync(`DELETE FROM entries WHERE metadata_json LIKE '%"__seed__"%'`);
  // 주식 시드 정리 — 스냅샷은 holdings의 __seed__ 키로 식별, quotes는 시드 티커 행 삭제(캐시라 무해).
  await db.runAsync(`DELETE FROM portfolio_snapshots WHERE holdings_json LIKE '%"__seed__"%'`);
  await db.runAsync(`DELETE FROM quotes WHERE ticker IN ('005930', 'AAPL', '035720')`);

  return { decisions: dc?.c ?? 0, entries: ec?.c ?? 0 };
}

export interface DbStats {
  userVersion: number;
  entries: number; decisions: number; outcomes: number; decisionLinks: number; transcripts: number;
}

export async function getDbStats(db: SQLiteDatabase): Promise<DbStats> {
  const ver = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const one = async (table: string) => {
    const r = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`);
    return r?.c ?? 0;
  };
  return {
    userVersion: ver?.user_version ?? 0,
    entries: await one('entries'),
    decisions: await one('decisions'),
    outcomes: await one('outcomes'),
    decisionLinks: await one('decision_links'),
    transcripts: await one('transcripts'),
  };
}
