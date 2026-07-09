import type { SQLiteDatabase } from 'expo-sqlite';

import type { DecisionCategory, EntryMode } from '@/types/domain';

export interface EntryStats {
  totalClips: number;
  totalDurationMs: number;
  daysRecorded: number;
  byMode: Record<EntryMode, number>;
  decisionsTotal: number;
  decisionsConfirmed: number; // confirmed + edited
  decisionsRejected: number;
  decisionsPending: number;   // extracted (검토 대기)
  byCategory: { category: DecisionCategory; count: number }[];
}

interface EntryRow {
  total: number; dur: number; days: number;
  voice: number; silent: number; audio: number; text: number; photo: number;
}
interface DecisionRow {
  total: number; confirmed: number; rejected: number; pending: number;
}
interface CategoryRow { cat: string; c: number }

/** 설정 통계 — 클립/분량/결정/카테고리 집계 (deleted_at IS NULL). */
export async function getEntryStats(db: SQLiteDatabase): Promise<EntryStats> {
  const e = await db.getFirstAsync<EntryRow>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(duration_ms), 0) AS dur,
       COUNT(DISTINCT strftime('%Y-%m-%d', recorded_at/1000, 'unixepoch', 'localtime')) AS days,
       SUM(CASE WHEN mode='voice'  THEN 1 ELSE 0 END) AS voice,
       SUM(CASE WHEN mode='silent' THEN 1 ELSE 0 END) AS silent,
       SUM(CASE WHEN mode='audio'  THEN 1 ELSE 0 END) AS audio,
       SUM(CASE WHEN mode='text'   THEN 1 ELSE 0 END) AS text,
       SUM(CASE WHEN mode='photo'  THEN 1 ELSE 0 END) AS photo
     FROM entries WHERE deleted_at IS NULL`,
  );

  const d = await db.getFirstAsync<DecisionRow>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status IN ('confirmed','edited') THEN 1 ELSE 0 END) AS confirmed,
       SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN status='extracted' THEN 1 ELSE 0 END) AS pending
     FROM decisions WHERE deleted_at IS NULL`,
  );

  const cats = await db.getAllAsync<CategoryRow>(
    `SELECT COALESCE(user_category, category) AS cat, COUNT(*) AS c
     FROM decisions
     WHERE deleted_at IS NULL AND status IN ('confirmed','edited')
     GROUP BY cat
     ORDER BY c DESC`,
  );

  return {
    totalClips: e?.total ?? 0,
    totalDurationMs: e?.dur ?? 0,
    daysRecorded: e?.days ?? 0,
    byMode: {
      voice: e?.voice ?? 0,
      silent: e?.silent ?? 0,
      audio: e?.audio ?? 0,
      text: e?.text ?? 0,
      photo: e?.photo ?? 0,
    },
    decisionsTotal: d?.total ?? 0,
    decisionsConfirmed: d?.confirmed ?? 0,
    decisionsRejected: d?.rejected ?? 0,
    decisionsPending: d?.pending ?? 0,
    byCategory: cats.map((r) => ({ category: r.cat as DecisionCategory, count: r.c })),
  };
}


// ─── 결정 리뷰 대시보드 (D4-a) ────────────────────────────────────────────────

export interface CategoryPerformance {
  label: string; // custom_category 우선, 없으면 user_category ?? category 키
  good: number; bad: number; mixed: number; unclear: number; skipped: number;
  total: number;
}

export interface CalibrationBucket {
  bucket: string;          // '0–60%' | '60–80%' | '80–100%'
  goodRate: number | null; // good / (good+bad+mixed), 표본 0이면 null
  sample: number;          // good+bad+mixed
  lowSample: boolean;      // 표본 5 미만
}

export interface DecisionPerformance {
  byCategory: CategoryPerformance[];
  calibration: CalibrationBucket[];
  executionLagDays: number | null; // confirmed_at→executed_at 경과일 중앙값
}

const RESULT_KEYS = ['good', 'bad', 'mixed', 'unclear', 'skipped'] as const;
type ResultKey = (typeof RESULT_KEYS)[number];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 결정 성과 집계 — 카테고리별 결과 분포 · confidence 보정(calibration) · 실행 지연 중앙값. */
export async function getDecisionPerformance(db: SQLiteDatabase): Promise<DecisionPerformance> {
  // ── byCategory: (라벨 × result) 카운트 → 라벨별 버킷으로 접기 ──
  const catRows = await db.getAllAsync<{ label: string; result: string; c: number }>(
    `SELECT
       COALESCE(NULLIF(d.custom_category, ''), d.user_category, d.category) AS label,
       o.result AS result, COUNT(*) AS c
     FROM decisions d
     JOIN outcomes o ON o.decision_id = d.id AND o.deleted_at IS NULL
     WHERE d.deleted_at IS NULL AND d.status IN ('confirmed', 'edited')
     GROUP BY label, o.result`,
  );
  const byLabel = new Map<string, CategoryPerformance>();
  for (const r of catRows) {
    const entry = byLabel.get(r.label) ??
      { label: r.label, good: 0, bad: 0, mixed: 0, unclear: 0, skipped: 0, total: 0 };
    if ((RESULT_KEYS as readonly string[]).includes(r.result)) {
      entry[r.result as ResultKey] += r.c;
    }
    entry.total += r.c;
    byLabel.set(r.label, entry);
  }
  const byCategory = [...byLabel.values()].sort((a, b) => b.total - a.total);

  // ── calibration: confidence 구간 × good율 ──
  const calRows = await db.getAllAsync<{ bucket: number; result: string; c: number }>(
    `SELECT
       CASE WHEN d.confidence < 0.6 THEN 0 WHEN d.confidence < 0.8 THEN 1 ELSE 2 END AS bucket,
       o.result AS result, COUNT(*) AS c
     FROM decisions d
     JOIN outcomes o ON o.decision_id = d.id AND o.deleted_at IS NULL
     WHERE d.deleted_at IS NULL AND d.status IN ('confirmed', 'edited')
       AND o.result IN ('good', 'bad', 'mixed')
     GROUP BY bucket, o.result`,
  );
  const BUCKET_LABELS = ['0–60%', '60–80%', '80–100%'];
  const good = [0, 0, 0];
  const sample = [0, 0, 0];
  for (const r of calRows) {
    sample[r.bucket] += r.c;
    if (r.result === 'good') good[r.bucket] += r.c;
  }
  const calibration: CalibrationBucket[] = BUCKET_LABELS.map((bucket, i) => ({
    bucket,
    goodRate: sample[i] > 0 ? good[i] / sample[i] : null,
    sample: sample[i],
    lowSample: sample[i] < 5,
  }));

  // ── executionLagDays: (executed_at - confirmed_at) 중앙값(일) ──
  const lagRows = await db.getAllAsync<{ lag: number }>(
    `SELECT (executed_at - confirmed_at) AS lag
     FROM decisions
     WHERE deleted_at IS NULL AND status IN ('confirmed', 'edited')
       AND confirmed_at IS NOT NULL AND executed_at IS NOT NULL
       AND executed_at >= confirmed_at`,
  );
  const medianMs = median(lagRows.map((r) => r.lag));
  const executionLagDays = medianMs == null ? null : Math.round(medianMs / 86_400_000);

  return { byCategory, calibration, executionLagDays };
}
