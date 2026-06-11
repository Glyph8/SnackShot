/**
 * 옵시디언 export 엔진 (ADR-026 2단계).
 *
 * 경로 구조:
 *   [vault]/SnackShot/
 *     entries/YYYY/MM/YYYY-MM-DD-HHmm_<ulid8>.md
 *     media/YYYY/MM/<ulid>.mp4 | .jpg | .m4a
 *
 * SAF 파일 쓰기는 expo-file-system 신 API (SDK 55) 사용:
 *   - Directory.createDirectory() / createFile() → SAF native
 *   - File.bytesSync() → Uint8Array  (로컬 파일 읽기)
 *   - File.write(Uint8Array) → SAF ContentResolver 쓰기
 *   - File.copy()는 SAF destination에서 javaFile 접근으로 throw → 사용 금지
 */

import { format } from 'date-fns';
import { Directory, File } from 'expo-file-system';

import type { Entry, Transcript } from '@/types/domain';
import type { ObsidianExportService } from './types';
import { type SAFDir, safGetOrCreateDir, safGetOrCreateFile } from './vault';

// ─── 마크다운 생성 ────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function buildMarkdown(
  entry: Entry,
  transcript: Transcript | null,
  mediaVaultPath: string | null,  // vault root 기준 상대 경로 ("SnackShot/media/YYYY/MM")
): string {
  const recordedDate = new Date(entry.recordedAt);
  // ISO 8601 로컬 시각 (ADR-013: 저장은 UTC ms, 표시는 로컬)
  const isoLocal = format(recordedDate, "yyyy-MM-dd'T'HH:mm:ssxxx");

  const lines: string[] = [
    '---',
    `snackshot_id: ${entry.id}`,
    `recorded_at: ${isoLocal}`,
    `mode: ${entry.mode}`,
    `duration: ${formatDuration(entry.durationMs)}`,
    '---',
    '',
  ];

  // 미디어 임베드 (vault root 기준 절대 경로 — Obsidian 권장 방식)
  if (mediaVaultPath) {
    if (entry.mode === 'voice' || entry.mode === 'silent') {
      if (entry.compressedPath) {
        lines.push(`![[${mediaVaultPath}/${entry.id}.mp4]]`);
      }
      if (entry.thumbnailPath) {
        lines.push(`![[${mediaVaultPath}/${entry.id}.jpg]]`);
      }
    } else if (entry.mode === 'audio') {
      lines.push(`![[${mediaVaultPath}/${entry.id}.m4a]]`);
    }
    lines.push('');
  }

  // 트랜스크립트 (editedText 우선 — ADR-016)
  const transcriptText = transcript?.editedText?.trim() ?? transcript?.rawText?.trim();
  if (transcriptText) {
    lines.push(transcriptText);
    lines.push('');
  }

  // 메모 (silent 모드 본문 또는 보조 노트)
  if (entry.manualNote?.trim()) {
    if (transcriptText) {
      lines.push('---');
      lines.push('');
    }
    lines.push(entry.manualNote.trim());
    lines.push('');
  }

  return lines.join('\n');
}

// ─── SAF 미디어 복사 (bytesSync + write 방식 — File.copy는 SAF 미지원) ──────

function copyLocalFileToSAF(localPath: string, safFile: File): void {
  const src = new File(localPath);
  if (!src.exists) return;
  safFile.write(src.bytesSync());
}

// ─── 경로 계산 ────────────────────────────────────────────────────────────────

function entryDateParts(recordedAt: number): { yyyy: string; mm: string; datehhmm: string } {
  const d = new Date(recordedAt);
  return {
    yyyy: format(d, 'yyyy'),
    mm: format(d, 'MM'),
    datehhmm: format(d, 'yyyy-MM-dd-HHmm'),
  };
}

// ─── 구현체 ──────────────────────────────────────────────────────────────────

function exportEntry(vaultDir: Directory, entry: Entry, transcript: Transcript | null): void {
  const dir = vaultDir as SAFDir;
  const snackShotDir = safGetOrCreateDir(dir, 'SnackShot');
  const { yyyy, mm, datehhmm } = entryDateParts(entry.recordedAt);

  // ── 미디어 파일 복사 ──
  const mediaDir = safGetOrCreateDir(
    safGetOrCreateDir(
      safGetOrCreateDir(snackShotDir, 'media'),
      yyyy,
    ),
    mm,
  );

  const mediaVaultPath = `SnackShot/media/${yyyy}/${mm}`;

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

  // ── 마크다운 파일 작성 ──
  const entriesDir = safGetOrCreateDir(
    safGetOrCreateDir(
      safGetOrCreateDir(snackShotDir, 'entries'),
      yyyy,
    ),
    mm,
  );

  const mdName = `${datehhmm}_${entry.id.slice(0, 8)}.md`;
  const mdFile = safGetOrCreateFile(entriesDir, mdName, 'text/markdown');
  const markdown = buildMarkdown(
    entry,
    transcript,
    // 미디어가 없는 경우(압축 실패·오디오) 임베드 생략
    entry.compressedPath || entry.thumbnailPath || (entry.mode === 'audio' && entry.originalPath)
      ? mediaVaultPath
      : null,
  );
  mdFile.write(markdown);
}

export const obsidianExportService: ObsidianExportService = { exportEntry };
