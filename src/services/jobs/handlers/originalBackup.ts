import { format } from 'date-fns';
import { Directory, File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getEntry, getSettings, markOriginalBackedUp, markOriginalPurged } from '@/db';
import { fileExists } from '@/lib/storage';
import {
  assertVaultWritable, buildChildTreeDocUri, safGetOrCreateDir, safSafeExists, type SAFDir,
} from '@/services/obsidian/vault';
import type { AiJob } from '@/types/domain';

import { CancelJobError } from './signals';

/**
 * 원본 백업 핸들러 (영상 관리 P2).
 *
 * 사용자가 선택한 백업 SAF 폴더의 `SnackShot-Backup/YYYY-MM/`에 원본을 복사하고,
 * 크기 검증 후 `original_backed_up_at`을 기록한다. 설정(`auto_purge_original`)이
 * 켜져 있고 이미 최종 단계(L3)면 백업 검증 후에만 로컬 원본을 삭제한다(비가역).
 *
 * ⚠️ 메모리 주의: SAF는 File.copy()가 막혀 있어(vault.ts 참조) bytesSync()로 읽어
 *    write()해야 한다. 원본이 매우 크면(수백 MB) 한 번에 메모리에 올라간다 —
 *    일반 2분 클립 수준에서는 허용 범위이나, 초대형 원본은 추후 스트리밍 검토 필요.
 */
export async function handleOriginalBackup(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const entry = await getEntry(db, job.targetId);
  if (!entry) throw new Error(`entry not found: ${job.targetId}`);

  if (entry.mode === 'text') {
    throw new CancelJobError('백업할 미디어가 없습니다 (text 엔트리).');
  }
  // 이미 백업됨 → 멱등 종료.
  if (entry.originalBackedUpAt != null) {
    console.log(`[backup] skip — already backed up id=${entry.id}`);
    return;
  }
  if (entry.originalPurgedAt != null || !fileExists(entry.originalPath)) {
    throw new CancelJobError('원본 파일이 없어 백업할 수 없습니다.');
  }

  const settings = await getSettings(db);
  if (!settings.backupDirUri) {
    throw new CancelJobError('백업 폴더가 설정되지 않았습니다. 설정 → 영상 백업에서 폴더를 선택하세요.');
  }

  const backupDir = new Directory(settings.backupDirUri);
  assertVaultWritable(backupDir); // SAF 권한 만료/이동 시 명확한 한국어 에러로 throw

  // SnackShot-Backup/YYYY-MM/ (월 단위 폴더 — 외부 저장장치로 통째 이동 용이)
  const monthLabel = format(new Date(entry.recordedAt), 'yyyy-MM');
  const root = safGetOrCreateDir(backupDir as SAFDir, 'SnackShot-Backup');
  const monthDir = safGetOrCreateDir(root, monthLabel);

  const ext = entry.mode === 'audio' ? 'm4a' : 'mp4';
  const mime = entry.mode === 'audio' ? 'audio/mp4' : 'video/mp4';
  const name = `${entry.id}_original.${ext}`;

  const src = new File(entry.originalPath);
  const srcSize = src.size ?? 0;

  // 멱등: 같은 이름+같은 크기 파일이 이미 있으면 재복사 생략. 크기 다르면(중단분) 지우고 재복사.
  let backupFileUri: string | null = null;
  const existingUri = buildChildTreeDocUri((monthDir as Directory).uri, name);
  if (existingUri && safSafeExists(new File(existingUri))) {
    const existing = new File(existingUri);
    if ((existing.size ?? -1) === srcSize) {
      backupFileUri = existingUri;
    } else {
      try { existing.delete(); } catch { /* 무시 — createFile이 재생성 */ }
    }
  }

  if (!backupFileUri) {
    const safFile = (monthDir as SAFDir).createFile(name, mime);
    safFile.write(src.bytesSync());
    const writtenSize = new File(safFile.uri).size ?? -1;
    if (writtenSize !== srcSize) {
      throw new Error('백업 파일 크기가 원본과 다릅니다. 다시 시도하세요.');
    }
    backupFileUri = safFile.uri;
  }

  await markOriginalBackedUp(db, entry.id, backupFileUri);
  console.log(`[backup] done id=${entry.id} → ${monthLabel}/${name}`);

  // 설정 게이트 + 안전장치: 검증 완료 후, 최종 단계(L3)일 때만 자동 원본 정리.
  // 그 외(일반 백업)는 보존하고, 수동 일괄 삭제(관리 화면)에서 확인 후 정리한다.
  if (settings.autoPurgeOriginal && (entry.compressionLevel ?? 0) >= 3) {
    if (src.exists) src.delete();
    await markOriginalPurged(db, entry.id);
    console.log(`[backup] original purged id=${entry.id}`);
  }
}
