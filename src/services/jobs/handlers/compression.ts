import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video } from 'react-native-compressor';

import { getEntry, updateCompressionResult } from '@/db';
import { buildEntryPaths, ensureEntryDir, fileExists } from '@/lib/storage';
import type { AiJob } from '@/types/domain';

// 다단계 압축 스펙 (영상 관리 P1, 제안서 SnackShot-VideoManagement-proposal.md).
//   L1 = ADR-022 기본(540p ~1.5Mbps). L2/L3는 심화(해상도·비트레이트↓).
//   각 단계는 항상 "원본"에서 재압축한다(압축본 재압축 시 화질 누적 손실 방지).
type CompressLevel = 1 | 2 | 3;
interface CompressSpec { maxSize: number; bitrate: number }

const COMPRESSION_SPECS: Record<CompressLevel, CompressSpec> = {
  1: { maxSize: 960, bitrate: 1_500_000 }, // ≈540p / 1.5Mbps
  2: { maxSize: 854, bitrate: 800_000 },   // ≈480p / 0.8Mbps
  3: { maxSize: 640, bitrate: 400_000 },   // ≈360p / 0.4Mbps
};

// payload_json의 { level } 파싱. 없거나 비정상이면 1(기본 압축).
function parseTargetLevel(payloadJson?: string): CompressLevel {
  if (!payloadJson) return 1;
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    const lvl = (parsed as { level?: unknown }).level;
    return lvl === 2 || lvl === 3 ? lvl : 1;
  } catch {
    return 1;
  }
}

/**
 * 압축 핸들러 (ADR-022 + 영상 관리 P1: 다단계).
 * 원본은 보존하고, 목표 단계 스펙으로 원본에서 재압축해 압축본/썸네일을 교체한다.
 * payload {level:2|3}로 심화 단계 지정(없으면 1).
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

  // 재압축은 항상 원본 필요. 백업 후 원본이 정리(purge)된 경우 재압축 불가 → 명확히 실패.
  if (!fileExists(entry.originalPath)) {
    throw new Error('원본 파일이 없어 압축할 수 없습니다 (백업 후 정리되었을 수 있음).');
  }

  const level = parseTargetLevel(job.payloadJson);
  const spec = COMPRESSION_SPECS[level];
  console.log(`[compression] start id=${entry.id} → L${level} (${spec.maxSize}px/${spec.bitrate})`);
  await updateCompressionResult(db, entry.id, 'processing');

  // maxSize = 가로/세로 중 긴 쪽 최대 px. 항상 원본에서 압축.
  const compressedUri = await Video.compress(
    entry.originalPath,
    {
      compressionMethod: 'manual',
      maxSize: spec.maxSize,
      bitrate: spec.bitrate,
      minimumFileSizeForCompress: 0,
    },
    (progress) =>
      console.log(`[compression] id=${entry.id} L${level} ${(progress * 100).toFixed(0)}%`),
  );

  // 첫 프레임 썸네일 생성
  const { uri: thumbTemp } = await VideoThumbnails.getThumbnailAsync(compressedUri, {
    time: 0,
    quality: 0.7,
  });

  // 도착지 디렉토리 보장 후 이동. 재압축 시 기존 압축본/썸네일을 먼저 지워야 move가 충돌하지 않는다.
  const paths = buildEntryPaths(entry.id, entry.recordedAt);
  ensureEntryDir(entry.id, entry.recordedAt);
  const destCompressed = new File(paths.compressedPath);
  if (destCompressed.exists) destCompressed.delete();
  const destThumb = new File(paths.thumbnailPath);
  if (destThumb.exists) destThumb.delete();
  new File(compressedUri).move(destCompressed);
  new File(thumbTemp).move(destThumb);

  await updateCompressionResult(db, entry.id, 'done', paths.compressedPath, paths.thumbnailPath, level);
  console.log(`[compression] done id=${entry.id} L${level} → ${paths.compressedPath}`);
}
