import type { SQLiteDatabase } from 'expo-sqlite';

import {
  cancelJob,
  claimNextJob,
  enqueueJob,
  getEntry,
  getSettings,
  markJobDone,
  markJobFailed,
  requeueJob,
  rescheduleJob,
  resetRunningJobs,
  updateAiLabelStatus,
  updateCompressionResult,
  updateSttStatus,
} from '@/db';
import { getGeminiKey } from '@/lib/env';
import { sweepVideoMaintenance } from '@/services/video/sweep';
import type { AiJob } from '@/types/domain';
import {
  CancelJobError, RescheduleError,
  handleCompression, handleLabelExtraction, handleObsidianExport, handleObsidianImport, handleOriginalBackup, handleQuoteFetch, handleStt,
} from './handlers';
import { JOB_STAGE_LABEL, classifyJobError } from './errors';

const MAX_ATTEMPTS = 3;
const POLL_MS = 5_000;

// 429 점진적 지연: attempt 1 → 5min, attempt 2 → 10min
function rateLimitDelay(attempt: number): number {
  return Math.min(attempt * 5 * 60_000, 10 * 60_000);
}

// 분류별 재시도 지연
function retryDelay(kind: ReturnType<typeof classifyJobError>['kind'], attempt: number): number {
  if (kind === 'rateLimit') return rateLimitDelay(attempt);
  if (kind === 'network' || kind === 'timeout') return 60_000;
  return 30_000;
}

// 모듈 레벨 싱글톤 — 동시 실행 1개 보장
let _busy = false;
let _timerId: ReturnType<typeof setInterval> | null = null;
// kickWorker가 db 인자 없이 즉시 1틱 돌릴 수 있도록 보관 (워커 시작 시 설정)
let _db: SQLiteDatabase | null = null;

export async function startWorker(db: SQLiteDatabase): Promise<void> {
  if (_timerId) {
    console.log('[worker] already running');
    return;
  }
  _db = db;
  // 앱 재시작 시 중단된 running 잡을 pending으로 복구
  await resetRunningJobs(db);
  // 영상 자동 관리 스윕 — 경과 영상의 단계 상향/백업 잡을 enqueue (설정 off면 no-op)
  try {
    await sweepVideoMaintenance(db);
  } catch (e) {
    console.error('[worker] sweep failed:', e);
  }
  console.log('[worker] start (poll every 5s)');
  _timerId = setInterval(() => tick(db), POLL_MS);
  tick(db); // 즉시 첫 틱 (스윕이 큐잉한 잡 포함)
}

export function stopWorker(): void {
  if (!_timerId) return;
  clearInterval(_timerId);
  _timerId = null;
  _busy = false;
  _db = null;
  console.log('[worker] stopped');
}

/**
 * enqueue 직후 폴링(5초)을 기다리지 않고 즉시 1틱을 트리거한다 (ADR-012 보완).
 * 워커 미시작 상태면 no-op. tick의 _busy 가드로 폴링과 동시 호출돼도 안전.
 */
export function kickWorker(): void {
  if (!_db) return; // 워커 미시작 시 무시
  tick(_db);
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
    // STT 완료 시 obsidian_export + label_extraction 자동 큐잉
    await maybeQueueObsidianExport(job, db);
    await maybeQueueLabelExtraction(job, db);
  } catch (e) {
    // 의존 조건 미충족 재예약 — 실패 카운트 소모 없이 일정 시간 뒤 재시도
    if (e instanceof RescheduleError) {
      await rescheduleJob(db, job.id, e.delayMs, e.message);
      console.log(
        `[worker] job=${job.id} ↷ rescheduled in ${(e.delayMs / 60_000).toFixed(0)}m: ${e.message}`,
      );
      return;
    }

    // vault 미연결 등 재시도 불필요 — cancelled 처리
    if (e instanceof CancelJobError) {
      await cancelJob(db, job.id);
      console.log(`[worker] job=${job.id} ✗ cancelled: ${e.message}`);
      return;
    }

    const err = e instanceof Error ? e.message : String(e);
    const info = classifyJobError(err, job.jobType);
    const stage = JOB_STAGE_LABEL[job.jobType];
    console.error(
      `[worker] ${stage} 실패 (attempt ${job.attempts}/${MAX_ATTEMPTS}) — ${info.why} → ${info.how} :: ${err}`,
    );

    if (!info.retryable) {
      // 재시도 무의미(키 없음·인증·파일 없음) → 즉시 실패 확정하여 사용자에게 알림
      await markJobFailed(db, job.id, err);
      await markEntryFailed(job, db);
      console.log(`[worker] ${stage} — 재시도 불가(${info.kind}) → 실패 확정 job=${job.id}`);
    } else if (job.attempts >= MAX_ATTEMPTS) {
      await markJobFailed(db, job.id, err);
      await markEntryFailed(job, db);
      console.log(`[worker] ${stage} — 최대 재시도 초과 → 실패 확정 job=${job.id}`);
    } else {
      const delay = retryDelay(info.kind, job.attempts);
      await requeueJob(db, job.id, err, delay);
      console.log(`[worker] ${stage} → ${(delay / 60_000).toFixed(1)}분 후 재시도 job=${job.id}`);
    }
  }
}

async function dispatch(job: AiJob, db: SQLiteDatabase): Promise<void> {
  switch (job.jobType) {
    case 'compression':
      return handleCompression(job, db);
    case 'stt':
      return handleStt(job, db);
    case 'obsidian_export':
      return handleObsidianExport(job, db);
    case 'obsidian_import':
      return handleObsidianImport(job, db);
    case 'label_extraction':
      return handleLabelExtraction(job, db);
    case 'original_backup':
      return handleOriginalBackup(job, db);
    case 'quote_fetch':
      return handleQuoteFetch(job, db);
    case 'outcome_followup':
      console.log(`[worker] skip — not yet implemented: ${job.jobType}`);
      return;
  }
}

// STT 잡 성공 후 obsidian_auto_export 설정에 따라 export 잡을 자동 큐잉한다.
async function maybeQueueObsidianExport(job: AiJob, db: SQLiteDatabase): Promise<void> {
  if (job.jobType !== 'stt') return;
  const entry = await getEntry(db, job.targetId);
  if (!entry) return;
  // STT가 done(음성/오디오) 또는 skipped(silent)인 경우에만
  if (entry.sttStatus !== 'done' && entry.sttStatus !== 'skipped') return;
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri || !settings.obsidianAutoExport) return;
  await enqueueJob(db, 'obsidian_export', entry.id, 'entries');
  console.log(`[worker] obsidian_export enqueued for entry=${entry.id}`);
  // 현재 tick 완료 후 다음 tick에서 처리 (별도 kickWorker 불필요)
}

// 영구 실패 시 entry 상태 갱신
async function markEntryFailed(job: AiJob, db: SQLiteDatabase): Promise<void> {
  if (job.jobType === 'compression') {
    await updateCompressionResult(db, job.targetId, 'failed');
  } else if (job.jobType === 'stt') {
    // STT 영구 실패 — Today 폴링 루프 종료를 위해 stt_status 갱신
    await updateSttStatus(db, job.targetId, 'failed');
  } else if (job.jobType === 'label_extraction') {
    await updateAiLabelStatus(db, job.targetId, 'failed');
  }
}

// STT 잡 성공 후 Gemini 키가 있으면 label_extraction 잡을 자동 큐잉한다.
async function maybeQueueLabelExtraction(job: AiJob, db: SQLiteDatabase): Promise<void> {
  if (job.jobType !== 'stt') return;
  const entry = await getEntry(db, job.targetId);
  if (!entry) return;
  // STT가 done(음성/오디오) 또는 skipped(silent)인 경우에만
  if (entry.sttStatus !== 'done' && entry.sttStatus !== 'skipped') return;
  const apiKey = await getGeminiKey();
  if (!apiKey) {
    console.log(`[worker] label_extraction skipped — Gemini 키 미설정 (entry=${entry.id})`);
    return;
  }
  await enqueueJob(db, 'label_extraction', entry.id, 'entries');
  console.log(`[worker] label_extraction enqueued for entry=${entry.id}`);
}
