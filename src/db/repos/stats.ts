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
  voice: number; silent: number; audio: number; text: number;
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
       SUM(CASE WHEN mode='text'   THEN 1 ELSE 0 END) AS text
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
    },
    decisionsTotal: d?.total ?? 0,
    decisionsConfirmed: d?.confirmed ?? 0,
    decisionsRejected: d?.rejected ?? 0,
    decisionsPending: d?.pending ?? 0,
    byCategory: cats.map((r) => ({ category: r.cat as DecisionCategory, count: r.c })),
  };
}
