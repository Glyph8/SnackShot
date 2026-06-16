/**
 * Entry 삭제 + 정리 (soft delete · 로컬 파일 · 옵시디언 vault).
 *
 * 상세 화면·Today·Archive 리스트가 공유하는 단일 경로.
 * 화면은 UI 갱신(목록에서 제거/뒤로가기)만 담당하고, 데이터/파일/vault 정리는 여기서 처리한다.
 */
import { Directory } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { cancelJobsForTarget, enqueueJob, getEntriesByDay, getSettings, softDeleteEntry } from '@/db';
import { deleteEntryFiles } from '@/lib/storage';
import { getDayBoundary } from '@/lib/time';
import { kickWorker } from '@/services/jobs/queue';
import { deleteEmptyDayNote, deleteEntryMediaFromVault } from '@/services/obsidian';
import type { Entry } from '@/types/domain';

export interface DeleteEntryOptions {
  deleteFiles: boolean;
  deleteFromVault: boolean;
}

export async function deleteEntryWithCleanup(
  db: SQLiteDatabase,
  entry: Entry,
  opts: DeleteEntryOptions,
): Promise<void> {
  const settings = await getSettings(db);
  const vaultUri = settings.obsidianVaultUri;
  const doVault = opts.deleteFromVault && !!vaultUri;

  // 1) vault 미디어 삭제 (soft delete 전에 — entry 정보가 필요)
  if (doVault) {
    try {
      const vaultDir = new Directory(vaultUri!);
      if (vaultDir.exists) deleteEntryMediaFromVault(vaultDir, entry);
    } catch (e) {
      console.warn('[deleteEntry] vault media cleanup failed:', e);
    }
  }

  // 2) DB soft delete + 진행 중 잡 cancel
  await softDeleteEntry(db, entry.id);
  await cancelJobsForTarget(db, entry.id);

  // 3) 로컬 파일 삭제
  if (opts.deleteFiles) deleteEntryFiles(entry);

  // 4) vault 데일리 노트 갱신 — 같은 날 다른 entry 1개를 트리거로 재export, 없으면 빈 노트 삭제
  if (doVault) {
    try {
      const { start, end } = getDayBoundary(entry.recordedAt, settings.dayBoundaryHour);
      const siblings = await getEntriesByDay(db, start, end);
      if (siblings.length > 0) {
        await enqueueJob(db, 'obsidian_export', siblings[0].id, 'entries');
        kickWorker();
      } else {
        const vaultDir = new Directory(vaultUri!);
        if (vaultDir.exists) deleteEmptyDayNote(vaultDir, entry.recordedAt, settings.dayBoundaryHour);
      }
    } catch (e) {
      console.warn('[deleteEntry] vault note refresh failed:', e);
    }
  }
}
