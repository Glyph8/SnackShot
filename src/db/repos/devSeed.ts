import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';

import { insertDecision } from './decisions';
import { insertDecisionLink } from './decisionLinks';
import { insertOutcome } from './outcomes';

// ⚠️ 개발/테스트 전용 — 시드 데이터 삽입·제거. 릴리스에서는 DevToolsSection(__DEV__) 뒤에 숨는다.
// 시드 행은 모두 마커로 표시해 안전하게 일괄 제거한다:
//   entries.metadata_json 에 "__seed__", decisions/outcomes.ai_engine='__seed__', decision_links.note='__seed__'.

export const SEED_MARKER = '__seed__';

export interface SeedResult {
  entries: number; decisions: number; outcomes: number; links: number;
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
    followUpAt?: number; customCategory?: string;
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

  // 연관 결정
  await insertDecisionLink(db, { fromDecisionId: dTy1.id, toDecisionId: dNow1.id, linkType: 'similar', note: SEED_MARKER });

  return { entries: 1, decisions: 7, outcomes: 3, links: 1 };
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
