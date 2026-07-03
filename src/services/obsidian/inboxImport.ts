import type { SQLiteDatabase } from 'expo-sqlite';

import { enqueueJob, getSettings, hasActiveJob } from '@/db';
import { kickWorker } from '@/services/jobs/queue';

// 옵시디언 수신함 import 잡 큐잉 헬퍼 (E1). vault 연결 시에만, 동일 타입 pending/running 있으면 skip.
// 합성 target — 수신함은 특정 entry가 아니라 vault 파일 하나이므로 고정 target_id를 쓴다.

const INBOX_JOB_TARGET = 'obsidian_inbox';

export async function enqueueObsidianImport(db: SQLiteDatabase): Promise<void> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) return;
  if (await hasActiveJob(db, INBOX_JOB_TARGET, 'obsidian_import')) return;
  await enqueueJob(db, 'obsidian_import', INBOX_JOB_TARGET, 'obsidian');
  kickWorker();
}
