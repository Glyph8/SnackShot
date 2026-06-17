import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video } from 'react-native-compressor';

import { getEntry, updateCompressionResult } from '@/db';
import { buildEntryPaths, ensureEntryDir } from '@/lib/storage';
import type { AiJob } from '@/types/domain';

// 기본 압축 스펙 (ADR-022 개정: 540p ~1.5Mbps — 일기용 화질 유지하며 용량 절감).
// 720p@3Mbps는 원본 대비 거의 안 줄어 압축률이 낮았다.
const COMPRESS_MAX_SIZE = 960;       // 긴 변 최대 px (≈540p)
const COMPRESS_BITRATE = 1_500_000;  // 1.5 Mbps

/**
 * 압축 핸들러 (ADR-022: react-native-compressor, 540p ~1.5Mbps).
 * 원본 파일은 보존, 압축본/썸네일을 entries 영구 경로로 이동.
 */
export async function handleCompression(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const entry = await getEntry(db, job.targetId);
  if (!entry) throw new Error(`entry not found: ${job.targetId}`);

  // text 모드 — 압축할 미디어 파일 자체가 없음 (정상 흐름이면 enqueue되지 않지만 방어).
  if (entry.mode === 'text') {
    console.log(`[compression] skip text id=${entry.id}`);
    await updateCompressionResult(db, entry.id, 'skipped');
    return;
  }

  console.log(`[compression] start id=${entry.id}`);
  await updateCompressionResult(db, entry.id, 'processing');

  // maxSize = 가로/세로 중 긴 쪽 최대 px (ADR-022 개정)
  const compressedUri = await Video.compress(
    entry.originalPath,
    {
      compressionMethod: 'manual',
      maxSize: COMPRESS_MAX_SIZE,
      bitrate: COMPRESS_BITRATE,
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
