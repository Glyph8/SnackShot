/**
 * 영상 유지보수 자동 스윕 (영상 관리 P3).
 *
 * 설정의 자동 관리가 켜져 있으면, N개월 경과한 활성 엔트리를 찾아
 *   - 압축 단계 상향(L2/L3): 경과 개월에 맞는 목표 단계로 compression 잡 enqueue
 *   - 원본 백업: 백업 폴더가 설정돼 있으면 original_backup 잡 enqueue
 * 을 수행한다. 멱등: 이미 같은 타입의 대기/진행 잡이 있으면 건너뛴다.
 *
 * 호출: startWorker 진입 시 1회(앱 실행마다) + 자동 관리를 켤 때. 한 번에 너무 많이
 * 큐잉하지 않도록 SWEEP_LIMIT로 제한 — 남은 대상은 다음 호출에서 이어서 처리한다.
 *
 * 잡 실제 처리·실패 재시도는 워커(queue.ts)가 담당한다. 여기선 enqueue만 한다.
 */

import { subMonths } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  enqueueJob, getEntriesForAutoBackup, getEntriesForAutoCompress, getSettings, hasActiveJob,
} from '@/db';
import { nowMs } from '@/lib/time';

const SWEEP_LIMIT = 50;

export async function sweepVideoMaintenance(db: SQLiteDatabase): Promise<void> {
  const s = await getSettings(db);
  if (!s.autoManageEnabled) return;

  const now = nowMs();
  const l2Cut = subMonths(new Date(now), s.autoL2AfterMonths).getTime();
  const l3Cut = subMonths(new Date(now), s.autoL3AfterMonths).getTime();
  const backupCut = subMonths(new Date(now), s.autoBackupAfterMonths).getTime();

  let compressQueued = 0;
  let backupQueued = 0;

  // ── 압축 단계 상향 ──
  // l2Cut(예: 3개월 전)보다 오래된 후보를 가져와, 각 엔트리의 목표 단계를 계산.
  const compressCandidates = await getEntriesForAutoCompress(db, l2Cut, SWEEP_LIMIT);
  for (const e of compressCandidates) {
    const target = e.recordedAt <= l3Cut ? 3 : 2;
    if ((e.compressionLevel ?? 0) >= target) continue;
    if (await hasActiveJob(db, e.id, 'compression')) continue;
    await enqueueJob(db, 'compression', e.id, 'entries', JSON.stringify({ level: target }));
    compressQueued += 1;
  }

  // ── 원본 백업 (백업 폴더가 설정된 경우만) ──
  if (s.backupDirUri) {
    const backupCandidates = await getEntriesForAutoBackup(db, backupCut, SWEEP_LIMIT);
    for (const e of backupCandidates) {
      if (await hasActiveJob(db, e.id, 'original_backup')) continue;
      await enqueueJob(db, 'original_backup', e.id, 'entries');
      backupQueued += 1;
    }
  }

  if (compressQueued > 0 || backupQueued > 0) {
    console.log(`[sweep] enqueued — compress=${compressQueued} backup=${backupQueued}`);
  }
}
