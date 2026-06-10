import type { SQLiteDatabase } from 'expo-sqlite';

import {
  claimNextJob,
  markJobDone,
  markJobFailed,
  requeueJob,
  resetRunningJobs,
  updateCompressionResult,
} from '@/db';
import type { AiJob } from '@/types/domain';
import { handleCompression } from './handlers';

const MAX_ATTEMPTS = 3;
const POLL_MS = 5_000;

// 모듈 레벨 싱글톤 — 동시 실행 1개 보장
let _busy = false;
let _timerId: ReturnType<typeof setInterval> | null = null;

export async function startWorker(db: SQLiteDatabase): Promise<void> {
  if (_timerId) {
    console.log('[worker] already running');
    return;
  }
  // 앱 재시작 시 중단된 running 잡을 pending으로 복구
  await resetRunningJobs(db);
  console.log('[worker] start (poll every 5s)');
  _timerId = setInterval(() => tick(db), POLL_MS);
  tick(db); // 즉시 첫 틱
}

export function stopWorker(): void {
  if (!_timerId) return;
  clearInterval(_timerId);
  _timerId = null;
  _busy = false;
  console.log('[worker] stopped');
}

// ─── 내부 ────────────────────────────────────────────────

async function tick(db: SQLiteDatabase): Promise<void> {
  if (_busy) return;
  _busy = true;
  try {
    const job = await claimNextJob(db);
    if (!job) return;
    await run(job, db);
  } catch (e) {
    console.error('[worker] tick error:', e);
  } finally {
    _busy = false;
  }
}

async function run(job: AiJob, db: SQLiteDatabase): Promise<void> {
  console.log(`[worker] job=${job.id} type=${job.jobType} attempt=${job.attempts}`);
  try {
    await dispatch(job, db);
    await markJobDone(db, job.id);
    console.log(`[worker] job=${job.id} ✓ done`);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error(`[worker] job=${job.id} ✗ failed (attempt ${job.attempts}): ${err}`);

    if (job.attempts >= MAX_ATTEMPTS) {
      // 최대 재시도 초과 → 영구 실패
      await markJobFailed(db, job.id, err);
      await markEntryFailed(job, db);
    } else {
      // 30초 후 재시도
      await requeueJob(db, job.id, err);
    }
  }
}

async function dispatch(job: AiJob, db: SQLiteDatabase): Promise<void> {
  switch (job.jobType) {
    case 'compression':
      return handleCompression(job, db);
    case 'stt':
    case 'label_extraction':
    case 'outcome_followup':
      console.log(`[worker] skip — not yet implemented: ${job.jobType}`);
      return;
  }
}

// 영구 실패 시 entry 상태 갱신
async function markEntryFailed(job: AiJob, db: SQLiteDatabase): Promise<void> {
  if (job.jobType === 'compression') {
    await updateCompressionResult(db, job.targetId, 'failed');
  }
}
