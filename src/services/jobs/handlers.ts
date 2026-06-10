import { File } from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video } from 'react-native-compressor';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getEntry, updateCompressionResult } from '@/db';
import { buildEntryPaths } from '@/lib/storage';
import type { AiJob } from '@/types/domain';

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

  // 임시 경로 → entries 영구 경로로 이동
  const paths = buildEntryPaths(entry.id, entry.recordedAt);
  new File(compressedUri).move(new File(paths.compressedPath));
  new File(thumbTemp).move(new File(paths.thumbnailPath));

  await updateCompressionResult(db, entry.id, 'done', paths.compressedPath, paths.thumbnailPath);
  console.log(`[compression] done id=${entry.id} → ${paths.compressedPath}`);
}
