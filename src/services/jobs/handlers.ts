import { File } from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video } from 'react-native-compressor';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getEntry, insertTranscript, updateCompressionResult, updateSttStatus } from '@/db';
import { buildEntryPaths, ensureEntryDir } from '@/lib/storage';
import { getSttService } from '@/services/stt';
import type { AiJob } from '@/types/domain';

// 의존 조건 미충족 시 재예약용 에러 — 실패 카운트를 소모하지 않음
export class RescheduleError extends Error {
  constructor(public readonly delayMs: number, message: string) {
    super(message);
    this.name = 'RescheduleError';
  }
}

/**
 * 압축 핸들러 (ADR-022: react-native-compressor, 720p ~3Mbps).
 * 원본 파일은 보존, 압축본/썸네일을 entries 영구 경로로 이동.
 */
export async function handleCompression(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const entry = await getEntry(db, job.targetId);
  if (!entry) throw new Error(`entry not found: ${job.targetId}`);

  console.log(`[compression] start id=${entry.id}`);
  await updateCompressionResult(db, entry.id, 'processing');

  // 720p 압축 — maxSize 1280 = 가로/세로 중 긴 쪽 최대 1280px (ADR-022)
  const compressedUri = await Video.compress(
    entry.originalPath,
    {
      compressionMethod: 'manual',
      maxSize: 1280,
      bitrate: 3_000_000,
      minimumFileSizeForCompress: 0,
    },
    (progress) =>
      console.log(`[compression] id=${entry.id} ${(progress * 100).toFixed(0)}%`),
  );

  // 첫 프레임 썸네일 생성
  const { uri: thumbTemp } = await VideoThumbnails.getThumbnailAsync(compressedUri, {
    time: 0,
    quality: 0.7,
  });

  // 도착지 디렉토리 보장 후 이동 (워커 실행 시점에 디렉토리가 없을 수 있음)
  const paths = buildEntryPaths(entry.id, entry.recordedAt);
  ensureEntryDir(entry.id, entry.recordedAt);
  new File(compressedUri).move(new File(paths.compressedPath));
  new File(thumbTemp).move(new File(paths.thumbnailPath));

  await updateCompressionResult(db, entry.id, 'done', paths.compressedPath, paths.thumbnailPath);
  console.log(`[compression] done id=${entry.id} → ${paths.compressedPath}`);
}

/**
 * STT 핸들러 (ADR-007: 클립별 즉시 처리, ADR-002: 인터페이스 추상화).
 * silent 모드 클립은 건너뜀.
 *
 * 오디오 소스: originalPath 사용.
 * react-native-compressor의 manual 모드가 일부 Android 기기에서
 * 오디오 트랙을 누락시키는 문제가 확인됨 (Whisper 응답 seconds=0).
 * 압축본은 재생/저장 전용이고, 전사는 원본을 쓴다.
 *
 * stt_status 전이: processing → done (성공) / skipped (silent).
 * 영구 실패 시 'failed'는 queue.ts의 markEntryFailed가 갱신한다.
 */
export async function handleStt(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const entry = await getEntry(db, job.targetId);
  if (!entry) throw new Error(`entry not found: ${job.targetId}`);

  // silent 모드 — 음성이 없으므로 STT 불필요 (방어적으로 'skipped' 기록)
  if (entry.mode === 'silent') {
    console.log(`[stt] skip silent id=${entry.id}`);
    await updateSttStatus(db, entry.id, 'skipped');
    return;
  }

  await updateSttStatus(db, entry.id, 'processing');

  // 원본 파일 존재 확인 — 녹화 직후 항상 생성되므로 누락이면 심각한 오류
  const audioFile = new File(entry.originalPath);
  if (!audioFile.exists) throw new Error(`original audio not found: ${entry.originalPath}`);
  console.log(`[stt] start id=${entry.id} size=${audioFile.size}B`);

  const sttService = getSttService();
  const result = await sttService.transcribe(entry.originalPath);
  const { name: engine, version: engineVersion } = sttService.getEngineInfo();

  // 비용 로그는 whisper.ts가 API 응답 duration 기준으로 출력하므로 여기선 결과 요약만
  console.log(
    `[stt] done id=${entry.id} lang=${result.language} chars=${result.text.length}`,
  );

  await insertTranscript(db, {
    entryId: entry.id,
    rawText: result.text,
    engine,
    engineVersion,
    language: result.language,
    confidence: result.confidence,
    segmentsJson: result.segments ? JSON.stringify(result.segments) : undefined,
  });

  await updateSttStatus(db, entry.id, 'done');
}
