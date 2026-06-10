/**
 * 영상 파일 경로 및 파일시스템 유틸.
 *
 * 디렉토리 구조 (로컬 날짜 기준 — 사용자가 "오늘" 단위로 탐색하기 때문, ADR-013):
 *   {documentDir}/entries/{yyyy}/{MM}/{dd}/{entryId}/
 *     original.mp4    — 녹화 원본
 *     compressed.mp4  — 압축본 (react-native-compressor)
 *     thumbnail.jpg   — 썸네일 (expo-video-thumbnails)
 *
 * expo-file-system SDK 55은 File/Directory 클래스 기반 동기 JSI API를 사용한다.
 * makeDirectoryAsync, getInfoAsync, deleteAsync 등 구 API는 런타임에서 throw한다.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { format } from 'date-fns';

import type { Entry } from '@/types/domain';

function buildDirectory(entryId: string, recordedAt: number): Directory {
  const datePath = format(new Date(recordedAt), 'yyyy/MM/dd');
  return new Directory(Paths.document, `entries/${datePath}/${entryId}`);
}

export interface EntryPaths {
  dir: string;
  originalPath: string;
  compressedPath: string;
  thumbnailPath: string;
}

/** 경로 집합 계산만 하고 디렉토리는 생성하지 않음 */
export function buildEntryPaths(entryId: string, recordedAt: number): EntryPaths {
  const dir = buildDirectory(entryId, recordedAt);
  return {
    dir: dir.uri,
    originalPath: new File(dir, 'original.mp4').uri,
    compressedPath: new File(dir, 'compressed.mp4').uri,
    thumbnailPath: new File(dir, 'thumbnail.jpg').uri,
  };
}

/** 녹화 직전 Entry 디렉토리 생성. 이미 존재하면 무시 (idempotent). */
export function ensureEntryDir(entryId: string, recordedAt: number): string {
  const dir = buildDirectory(entryId, recordedAt);
  dir.create({ intermediates: true, idempotent: true });
  return dir.uri;
}

/** 파일 존재 여부 확인 */
export function fileExists(path: string): boolean {
  return new File(path).exists;
}

/**
 * Soft delete된 Entry의 실제 파일 삭제.
 * 파일이 없으면 그냥 넘어감.
 */
export function deleteEntryFiles(entry: Entry): void {
  const paths = [entry.originalPath, entry.compressedPath, entry.thumbnailPath].filter(
    (p): p is string => Boolean(p),
  );
  for (const p of paths) {
    const file = new File(p);
    if (file.exists) file.delete();
  }
}
