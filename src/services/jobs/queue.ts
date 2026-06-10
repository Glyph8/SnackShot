import type { SQLiteDatabase } from 'expo-sqlite';

import {
  claimNextJob,
  markJobDone,
  markJobFailed,
  requeueJob,
  rescheduleJob,
  resetRunningJobs,
  updateAiLabelStatus,
  updateCompressionResult,
} from '@/db';
import type { AiJob } from '@/types/domain';
import { RescheduleError, handleCompression, handleStt } from './handlers';

const MAX_ATTEMPTS = 3;
const POLL_MS = 5_000;

// 429 rate-limit 감지 — Whisper 에러 메시지 기준
function is429(msg: string): boolean {
  return msg.includes('429');
}

// 429 점진적 지연: attempt 1 → 5min, attempt 2 → 10min
function rateLimitDelay(attempt: number): number {
  return Math.min(attempt * 5 * 60_000, 10 * 60_000);
}

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
    // 의존 조건 미충족 재예약 — 실패 카운트 소모 없이 일정 시간 뒤 재시도
    if (e instanceof RescheduleError) {
      await rescheduleJob(db, job.id, e.delayMs, e.message);
      console.log(
        `[worker] job=${job.id} ↷ rescheduled in ${(e.delayMs / 60_000).toFixed(0)}m: ${e.message}`,
      );
      return;
    }

    const err = e instanceof Error ? e.message : String(e);
    console.error(`[worker] job=${job.id} ✗ failed (attempt ${job.attempts}): ${err}`);

    if (job.attempts >= MAX_ATTEMPTS) {
      await markJobFailed(db, job.id, err);
      await markEntryFailed(job, db);
    } else if (is429(err)) {
      // rate-limit: 즉시 재시도하지 않고 점진적 지연
      const delay = rateLimitDelay(job.attempts);
      await requeueJob(db, job.id, err, delay);
      console.log(`[worker] job=${job.id} rate-limited → retry in ${(delay / 60_000).toFixed(0)}m`);
    } else {
      await requeueJob(db, job.id, err);
    }
  }
}

async function dispatch(job: AiJob, db: SQLiteDatabase): Promise<void> {
  switch (job.jobType) {
    case 'compression':
      return handleCompression(job, db);
    case 'stt':
      return handleStt(job, db);
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
  } else if (job.jobType === 'stt') {
    // STT 영구 실패 — Today 폴링 루프 종료를 위해 상태 갱신
    await updateAiLabelStatus(db, job.targetId, 'failed');
  }
}
