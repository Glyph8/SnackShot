/**
 * 캡처(영상/오디오) 미리보기 → Entry 저장 + 후속 잡 큐잉 단일 경로.
 *
 * preview.tsx(영상)·preview-audio.tsx(오디오)가 공유한다. 화면은 입력 수집·UI 전환만
 * 담당하고, 파일 이동·DB 기록·잡 큐잉은 여기서 처리한다(레이어 원칙: 다단계 워크플로는 service).
 *
 * mode에 따른 분기:
 * - voice/silent (영상): buildEntryPaths, compression 잡 큐잉. voice만 stt.
 * - audio (오디오): buildAudioEntryPaths, 압축 없음(compression_status='skipped'), stt 큐잉.
 * - decisionId 있으면(후속확인 "영상/음성으로" 경로): outcome 연결 + 옵시디언 자동 export (ADR-017).
 */
import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  enqueueJob, getDecision, getSettings, insertEntry, insertOutcome,
  setUserDecisionHint, updateCompressionResult, updateManualNote,
} from '@/db';
import { newId } from '@/lib/id';
import { buildAudioEntryPaths, buildEntryPaths, ensureEntryDir } from '@/lib/storage';
import { kickWorker } from '@/services/jobs/queue';
import type { Entry, EntryMode } from '@/types/domain';

export interface SaveCapturedEntryParams {
  /** 녹화/녹음 캐시 파일 URI (entries 디렉토리로 이동된다) */
  uri: string;
  recordedAt: number;
  durationMs: number;
  mode: EntryMode; // 'voice' | 'silent' | 'audio'
  hint: boolean;
  note: string;
  /** 후속 확인 경로에서 이 클립을 결정의 결과로 연결 (ADR-017) */
  decisionId?: string;
}

export async function saveCapturedEntry(
  db: SQLiteDatabase,
  params: SaveCapturedEntryParams,
): Promise<Entry> {
  const { uri, recordedAt, durationMs, mode, hint, note, decisionId } = params;
  const isAudio = mode === 'audio';

  const entryId = newId();
  const paths = isAudio
    ? buildAudioEntryPaths(entryId, recordedAt)
    : buildEntryPaths(entryId, recordedAt);

  // 캐시 → entries 디렉토리로 이동
  ensureEntryDir(entryId, recordedAt);
  new File(uri).move(new File(paths.originalPath));

  const entry = await insertEntry(db, {
    recordedAt,
    originalPath: paths.originalPath,
    durationMs,
    mode,
  });

  // 오디오는 영상 압축 없음 → skipped
  if (isAudio) await updateCompressionResult(db, entry.id, 'skipped');

  if (hint) await setUserDecisionHint(db, entry.id, true);
  const trimmed = note.trim();
  if (trimmed) await updateManualNote(db, entry.id, trimmed);

  // 후속 확인 경로: 결정의 결과로 연결 + 옵시디언 자동 export
  if (decisionId) {
    await insertOutcome(db, { decisionId, entryId: entry.id, result: 'unclear' });
    const settings = await getSettings(db);
    if (settings.obsidianVaultUri && settings.obsidianAutoExport) {
      const decision = await getDecision(db, decisionId);
      if (decision) {
        await enqueueJob(db, 'obsidian_export', decision.entryId, 'entries');
      }
    }
  }

  // 백그라운드 잡 큐잉 (ADR-012)
  if (!isAudio) await enqueueJob(db, 'compression', entry.id, 'entries');
  if (mode === 'voice' || isAudio) await enqueueJob(db, 'stt', entry.id, 'entries');
  kickWorker(); // 5초 폴링 대기 없이 즉시 1틱

  return entry;
}
