import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Holding, PortfolioSnapshot } from '@/services/trade/portfolio';

// H3: 포트폴리오 스냅샷 repo. holdings는 JSON 컬럼(파싱은 호출자 책임, 읽기 실패 시 빈 배열).

function toSnapshot(row: {
  id: string; created_at: number; source: string; holdings_json: string; deleted_at: number | null;
}): PortfolioSnapshot {
  let holdings: Holding[] = [];
  try {
    const parsed: unknown = JSON.parse(row.holdings_json);
    if (Array.isArray(parsed)) holdings = parsed as Holding[];
  } catch {
    holdings = [];
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    source: row.source === 'manual' ? 'manual' : 'image',
    holdings,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export async function insertPortfolioSnapshot(
  db: SQLiteDatabase,
  params: { source: 'image' | 'manual'; holdings: Holding[] },
): Promise<PortfolioSnapshot> {
  const id = newId();
  const createdAt = nowMs();
  const holdingsJson = JSON.stringify(params.holdings);
  await db.runAsync(
    `INSERT INTO portfolio_snapshots (id, created_at, source, holdings_json, deleted_at)
     VALUES (?, ?, ?, ?, NULL)`,
    [id, createdAt, params.source, holdingsJson],
  );
  return { id, createdAt, source: params.source, holdings: params.holdings };
}

export async function getLatestPortfolioSnapshot(
  db: SQLiteDatabase,
): Promise<PortfolioSnapshot | null> {
  const row = await db.getFirstAsync<{
    id: string; created_at: number; source: string; holdings_json: string; deleted_at: number | null;
  }>(
    `SELECT * FROM portfolio_snapshots
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
  );
  return row ? toSnapshot(row) : null;
}

export async function listPortfolioSnapshots(
  db: SQLiteDatabase,
  limit = 20,
): Promise<PortfolioSnapshot[]> {
  const rows = await db.getAllAsync<{
    id: string; created_at: number; source: string; holdings_json: string; deleted_at: number | null;
  }>(
    `SELECT * FROM portfolio_snapshots
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toSnapshot);
}

export async function softDeletePortfolioSnapshot(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE portfolio_snapshots SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    [nowMs(), id],
  );
}
