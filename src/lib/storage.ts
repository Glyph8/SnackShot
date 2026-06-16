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

/** 오디오 전용 경로 (원본 .m4a 1개만) */
export interface AudioEntryPaths {
  dir: string;
  originalPath: string;
}

export function buildAudioEntryPaths(entryId: string, recordedAt: number): AudioEntryPaths {
  const dir = buildDirectory(entryId, recordedAt);
  return {
    dir: dir.uri,
    originalPath: new File(dir, 'original.m4a').uri,
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

/** entries/ 디렉토리 전체가 차지하는 바이트 수 (통계용). 없으면 0. */
export function getEntriesStorageBytes(): number {
  try {
    const root = new Directory(Paths.document, 'entries');
    if (!root.exists) return 0;
    return dirBytes(root);
  } catch {
    return 0;
  }
}

function dirBytes(dir: Directory): number {
  let total = 0;
  for (const item of dir.list()) {
    if (item instanceof File) total += item.size ?? 0;
    else total += dirBytes(item);
  }
  return total;
}

function fileBytes(path?: string): number {
  if (!path) return 0;
  try {
    const f = new File(path);
    return f.exists ? (f.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export interface StorageBreakdown {
  entriesTotal: number;                                  // 엔트리 파일 합계
  byKind: { original: number; compressed: number; thumbnail: number };
  byMode: { video: number; audio: number };              // video = voice+silent
  byMonth: { month: string; bytes: number }[];           // 'YYYY-MM' 최신순
}

interface MediaRow {
  mode: string; recordedAt: number;
  originalPath: string; compressedPath?: string; thumbnailPath?: string;
}

/** 엔트리 미디어 목록으로 종류별/유형별/월별 용량 분해. */
export function getStorageBreakdown(rows: MediaRow[]): StorageBreakdown {
  const byKind = { original: 0, compressed: 0, thumbnail: 0 };
  const byMode = { video: 0, audio: 0 };
  const monthMap = new Map<string, number>();

  for (const r of rows) {
    const o = fileBytes(r.originalPath);
    const c = fileBytes(r.compressedPath);
    const t = fileBytes(r.thumbnailPath);
    byKind.original += o;
    byKind.compressed += c;
    byKind.thumbnail += t;

    const entryBytes = o + c + t;
    if (r.mode === 'audio') byMode.audio += entryBytes;
    else if (r.mode === 'voice' || r.mode === 'silent') byMode.video += entryBytes;

    const month = new Date(r.recordedAt).toISOString().slice(0, 7); // YYYY-MM
    monthMap.set(month, (monthMap.get(month) ?? 0) + entryBytes);
  }

  const entriesTotal = byKind.original + byKind.compressed + byKind.thumbnail;
  const byMonth = [...monthMap.entries()]
    .map(([month, bytes]) => ({ month, bytes }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  return { entriesTotal, byKind, byMode, byMonth };
}

/**
 * Soft delete된 Entry의 실제 파일 삭제.
 * 파일이 없으면 그냥 넘어감.
 *
 * text mode entry는 미디어 파일이 없다(originalPath=''). 빈 문자열을 명시적으로
 * 걸러내 File 생성/삭제 시도 자체를 차단한다.
 */
export function deleteEntryFiles(entry: Entry): void {
  // text mode 단축 경로: 삭제할 파일 자체가 없음.
  if (entry.mode === 'text') return;

  const paths = [entry.originalPath, entry.compressedPath, entry.thumbnailPath].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  for (const p of paths) {
    const file = new File(p);
    if (file.exists) file.delete();
  }
}
