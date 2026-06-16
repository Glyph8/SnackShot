import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import { makeRowMapper } from '@/db/mapping';
import type { AiJob, AiJobStatus, AiJobType } from '@/types/domain';

const toAiJob = makeRowMapper<AiJob>({
  id: ['id', 'req'],
  jobType: ['job_type', 'req'],
  targetId: ['target_id', 'req'],
  targetTable: ['target_table', 'req'],
  status: ['status', 'req'],
  attempts: ['attempts', 'req'],
  lastError: ['last_error', 'opt'],
  scheduledAt: ['scheduled_at', 'req'],
  startedAt: ['started_at', 'opt'],
  completedAt: ['completed_at', 'opt'],
  payloadJson: ['payload_json', 'opt'],
});

export async function enqueueJob(
  db: SQLiteDatabase,
  type: AiJobType,
  targetId: string,
  targetTable: string,
  payloadJson?: string,
): Promise<AiJob> {
  const id = newId();
  const scheduledAt = nowMs();
  await db.runAsync(
    `INSERT INTO ai_jobs (id, job_type, target_id, target_table, status, attempts, scheduled_at, payload_json)
     VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`,
    [id, type, targetId, targetTable, scheduledAt, payloadJson ?? null],
  );
  return {
    id, jobType: type, targetId, targetTable,
    status: 'pending', attempts: 0, scheduledAt,
    payloadJson,
  };
}

// 처리 가능한 pending 잡 조회 (scheduled_at <= now)
export async function getPendingJobs(
  db: SQLiteDatabase,
  limit = 5,
): Promise<AiJob[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ai_jobs
     WHERE status = 'pending' AND scheduled_at <= ?
     ORDER BY scheduled_at ASC LIMIT ?`,
    [nowMs(), limit],
  );
  return rows.map(toAiJob);
}

// 특정 entry+잡타입의 최신 잡 1건 (실패 사유/상태 표시용)
export async function getLastJobForTarget(
  db: SQLiteDatabase,
  targetId: string,
  jobType: AiJobType,
): Promise<AiJob | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ai_jobs
     WHERE target_id = ? AND job_type = ?
     ORDER BY COALESCE(completed_at, started_at, scheduled_at) DESC
     LIMIT 1`,
    [targetId, jobType],
  );
  return row ? toAiJob(row) : null;
}

export async function markJobRunning(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs SET status = 'running', started_at = ?, attempts = attempts + 1 WHERE id = ?`,
    [nowMs(), id],
  );
}

export async function markJobDone(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs SET status = 'done', completed_at = ? WHERE id = ?`,
    [nowMs(), id],
  );
}

export async function markJobFailed(
  db: SQLiteDatabase,
  id: string,
  error: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs SET status = 'failed', last_error = ?, completed_at = ? WHERE id = ?`,
    [error, nowMs(), id],
  );
}

// 원자적 클레임: pending → running + attempts++ (트랜잭션 보장, ADR-012)
export async function claimNextJob(db: SQLiteDatabase): Promise<AiJob | null> {
  let claimed: AiJob | null = null;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM ai_jobs
       WHERE status = 'pending' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC LIMIT 1`,
      [nowMs()],
    );
    if (!row) return;
    const job = toAiJob(row);
    const now = nowMs();
    await db.runAsync(
      `UPDATE ai_jobs SET status = 'running', started_at = ?, attempts = attempts + 1 WHERE id = ?`,
      [now, job.id],
    );
    claimed = { ...job, status: 'running', attempts: job.attempts + 1, startedAt: now };
  });
  return claimed;
}

// 실패 후 재시도 — 기본 30초, delayMs로 재정의 가능
export async function requeueJob(
  db: SQLiteDatabase,
  id: string,
  error: string,
  delayMs = 30_000,
): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs SET status = 'pending', last_error = ?, scheduled_at = ? WHERE id = ?`,
    [error, nowMs() + delayMs, id],
  );
}

// 의존 조건 미충족 재예약 — attempt 카운트를 클레임 전으로 롤백하여 소모하지 않음
export async function rescheduleJob(
  db: SQLiteDatabase,
  id: string,
  delayMs: number,
  reason: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs SET status = 'pending', last_error = ?, scheduled_at = ?, attempts = MAX(0, attempts - 1) WHERE id = ?`,
    [reason, nowMs() + delayMs, id],
  );
}

// 앱 재시작 시 중단된 running 잡을 pending으로 되돌림
export async function resetRunningJobs(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(`UPDATE ai_jobs SET status = 'pending' WHERE status = 'running'`);
}

// 단건 취소 — vault 미연결 등 재시도 불필요한 상황
export async function cancelJob(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs SET status = 'cancelled', completed_at = ? WHERE id = ?`,
    [nowMs(), id],
  );
}

// Entry soft delete 시 관련 pending/running 잡 일괄 취소
export async function cancelJobsForTarget(
  db: SQLiteDatabase,
  targetId: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs SET status = 'cancelled'
     WHERE target_id = ? AND status IN ('pending', 'running')`,
    [targetId],
  );
}

// ───────── Obsidian export 통계/통제 (ADR-026 3단계) ─────────

export interface ObsidianExportStats {
  lastSuccessAt: number | null;
  pendingCount: number;
  failedCount: number;
}

interface ObsidianExportStatsRow {
  last_success_at: number | null;
  pending_count: number;
  failed_count: number;
}

// 설정 화면용 단일 SELECT 집계. job_type='obsidian_export' 한정.
export async function getObsidianExportStats(
  db: SQLiteDatabase,
): Promise<ObsidianExportStats> {
  const row = await db.getFirstAsync<ObsidianExportStatsRow>(
    `SELECT
       MAX(CASE WHEN status = 'done' THEN completed_at END) AS last_success_at,
       SUM(CASE WHEN status IN ('pending','running') THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
     FROM ai_jobs
     WHERE job_type = 'obsidian_export'`,
  );
  return {
    lastSuccessAt: row?.last_success_at ?? null,
    pendingCount: row?.pending_count ?? 0,
    failedCount: row?.failed_count ?? 0,
  };
}

// 실패한 obsidian_export 잡 일괄 재시도. 반환: 영향받은 row 수.
export async function retryFailedObsidianExports(
  db: SQLiteDatabase,
): Promise<number> {
  const result = await db.runAsync(
    `UPDATE ai_jobs
     SET status = 'pending',
         scheduled_at = ?,
         last_error = NULL,
         attempts = 0
     WHERE job_type = 'obsidian_export' AND status = 'failed'`,
    [nowMs()],
  );
  return result.changes;
}

// pending/running obsidian_export 잡 일괄 취소 (vault 해제 등).
export async function cancelPendingObsidianExports(
  db: SQLiteDatabase,
): Promise<void> {
  await db.runAsync(
    `UPDATE ai_jobs
     SET status = 'cancelled', completed_at = ?
     WHERE job_type = 'obsidian_export' AND status IN ('pending','running')`,
    [nowMs()],
  );
}
