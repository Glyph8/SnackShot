/**
 * 옵시디언 export 엔진 (ADR-026 2단계).
 *
 * 경로 구조:
 *   [vault]/SnackShot/
 *     entries/YYYY/MM/YYYY-MM-DD.md   ← 하루당 1개 데일리 노트
 *     media/YYYY/MM/<ulid>.mp4 | .jpg | .m4a
 *
 * 데일리 노트는 매번 그 날 전체를 재생성한다 (섹션 단위 append 아님).
 * 이유: append 방식은 같은 클립의 재export(트랜스크립트 수정 등)에서
 * 중복 섹션을 만든다. 전체 재생성은 항상 시간순 + 중복 없음을 보장한다.
 *
 * SAF 파일 쓰기는 expo-file-system 신 API (SDK 55) 사용:
 *   - Directory.createDirectory() / createFile() → SAF native
 *   - File.bytesSync() → Uint8Array  (로컬 파일 읽기)
 *   - File.write(Uint8Array) → SAF ContentResolver 쓰기
 *   - File.copy()는 SAF destination에서 javaFile 접근으로 throw → 사용 금지
 */

import { format } from 'date-fns';
import { Directory, File } from 'expo-file-system';

import type { EntryMode } from '@/types/domain';
import type { DayExportItem, ObsidianExportService } from './types';
import { type SAFDir, safGetOrCreateDir, safGetOrCreateFile } from './vault';

// ─── 마크다운 생성 ────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const MODE_LABEL: Record<EntryMode, string> = {
  voice: '영상',
  silent: '무음 영상',
  audio: '음성',
};

function buildEntrySection(item: DayExportItem, mediaVaultPath: string): string[] {
  const { entry, transcript } = item;
  const lines: string[] = [
    `## ${format(new Date(entry.recordedAt), 'HH:mm')} — ${MODE_LABEL[entry.mode]} (${formatDuration(entry.durationMs)})`,
    `%% snackshot_id: ${entry.id} %%`,
    '',
  ];

  // 미디어 임베드 — 영상은 mp4만 임베드 (썸네일은 git용으로 복사만, 노트엔 중복 표시 방지)
  if ((entry.mode === 'voice' || entry.mode === 'silent') && entry.compressedPath) {
    lines.push(`![[${mediaVaultPath}/${entry.id}.mp4]]`, '');
  } else if (entry.mode === 'audio' && entry.originalPath) {
    lines.push(`![[${mediaVaultPath}/${entry.id}.m4a]]`, '');
  }

  // 트랜스크립트 (editedText 우선 — ADR-016)
  const transcriptText = transcript?.editedText?.trim() ?? transcript?.rawText?.trim();
  if (transcriptText) {
    lines.push(transcriptText, '');
  }

  // 메모
  if (entry.manualNote?.trim()) {
    if (transcriptText) lines.push('---', '');
    lines.push(entry.manualNote.trim(), '');
  }

  return lines;
}

function buildDayMarkdown(
  logicalDate: string,
  items: DayExportItem[],
  mediaVaultPath: string,
): string {
  const lines: string[] = [
    '---',
    `date: ${logicalDate}`,
    'source: SnackShot',
    '---',
    '',
  ];
  for (const item of items) {
    lines.push(...buildEntrySection(item, mediaVaultPath));
  }
  return lines.join('\n');
}

// ─── SAF 미디어 복사 (bytesSync + write 방식 — File.copy는 SAF 미지원) ──────

function copyLocalFileToSAF(localPath: string, safFile: File): void {
  const src = new File(localPath);
  if (!src.exists) return;
  safFile.write(src.bytesSync());
}

// ─── 구현체 ──────────────────────────────────────────────────────────────────

function exportDay(
  vaultDir: Directory,
  logicalDate: string,
  items: DayExportItem[],
): void {
  const dir = vaultDir as SAFDir;
  const snackShotDir = safGetOrCreateDir(dir, 'SnackShot');
  const yyyy = logicalDate.slice(0, 4);
  const mm = logicalDate.slice(5, 7);
  const mediaVaultPath = `SnackShot/media/${yyyy}/${mm}`;

  // ── 미디어 파일 복사 (클립별) ──
  const mediaDir = safGetOrCreateDir(
    safGetOrCreateDir(safGetOrCreateDir(snackShotDir, 'media'), yyyy),
    mm,
  );

  for (const { entry } of items) {
    if (entry.mode === 'voice' || entry.mode === 'silent') {
      if (entry.compressedPath) {
        copyLocalFileToSAF(
          entry.compressedPath,
          safGetOrCreateFile(mediaDir, `${entry.id}.mp4`, 'video/mp4'),
        );
      }
      if (entry.thumbnailPath) {
        copyLocalFileToSAF(
          entry.thumbnailPath,
          safGetOrCreateFile(mediaDir, `${entry.id}.jpg`, 'image/jpeg'),
        );
      }
    } else if (entry.mode === 'audio' && entry.originalPath) {
      copyLocalFileToSAF(
        entry.originalPath,
        safGetOrCreateFile(mediaDir, `${entry.id}.m4a`, 'audio/mp4'),
      );
    }
  }

  // ── 데일리 노트 재생성 ──
  const entriesDir = safGetOrCreateDir(
    safGetOrCreateDir(safGetOrCreateDir(snackShotDir, 'entries'), yyyy),
    mm,
  );
  const mdFile = safGetOrCreateFile(entriesDir, `${logicalDate}.md`, 'text/markdown');
  mdFile.write(buildDayMarkdown(logicalDate, items, mediaVaultPath));
}

export const obsidianExportService: ObsidianExportService = { exportDay };
