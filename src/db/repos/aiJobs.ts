import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { AiJob, AiJobStatus, AiJobType } from '@/types/domain';

interface AiJobRow {
  id: string;
  job_type: string;
  target_id: string;
  target_table: string;
  status: string;
  attempts: number;
  last_error: string | null;
  scheduled_at: number;
  started_at: number | null;
  completed_at: number | null;
  payload_json: string | null;
}

function toAiJob(row: AiJobRow): AiJob {
  return {
    id: row.id,
    jobType: row.job_type as AiJobType,
    targetId: row.target_id,
    targetTable: row.target_table,
    status: row.status as AiJobStatus,
    attempts: row.attempts,
    lastError: row.last_error ?? undefined,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    payloadJson: row.payload_json ?? undefined,
  };
}

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
  const rows = await db.getAllAsync<AiJobRow>(
    `SELECT * FROM ai_jobs
     WHERE status = 'pending' AND scheduled_at <= ?
     ORDER BY scheduled_at ASC LIMIT ?`,
    [nowMs(), limit],
  );
  return rows.map(toAiJob);
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
    const row = await db.getFirstAsync<AiJobRow>(
      `SELECT * FROM ai_jobs
       WHERE status = 'pending' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC LIMIT 1`,
      [nowMs()],
    );
    if (!row) return;
    const now = nowMs();
    await db.runAsync(
      `UPDATE ai_jobs SET status = 'running', started_at = ?, attempts = attempts + 1 WHERE id = ?`,
      [now, row.id],
    );
    claimed = toAiJob({ ...row, status: 'running', attempts: row.attempts + 1, started_at: now });
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
