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

import type { DecisionCategory, EntryMode, OutcomeResult } from '@/types/domain';
import type { DayExportItem, DecisionExportItem, ObsidianExportService } from './types';
import {
  buildChildTreeDocUri,
  type SAFDir,
  safGetOrCreateDir,
  safGetOrCreateFile,
} from './vault';

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

const CATEGORY_LABEL: Record<DecisionCategory, string> = {
  investment: '투자',
  relationship: '관계',
  career: '커리어',
  daily: '일상',
  other: '기타',
};

const OUTCOME_LABEL: Record<OutcomeResult, string> = {
  good: '좋았음',
  bad: '아쉬웠음',
  mixed: '복합적',
  unclear: '기억 안 남',
  skipped: '기록 안 함',
};

// Obsidian callout — 각 줄은 '> '로 시작해야 callout 블록으로 인식됨
function buildDecisionCallout(item: DecisionExportItem): string[] {
  const { decision, outcome } = item;
  const summary = decision.userSummary ?? decision.summary;
  const category = decision.userCategory ?? decision.category;
  const catLabel = CATEGORY_LABEL[category] ?? category;

  const lines: string[] = [
    `> [!decision] ${summary} (${catLabel})`,
  ];

  if (decision.evidenceQuote) {
    lines.push(`> **근거**: ${decision.evidenceQuote}`);
  }

  if (decision.followUpAt) {
    lines.push(`> **후속 확인**: ${format(new Date(decision.followUpAt), 'yyyy-MM-dd')}`);
  }

  if (outcome) {
    const dateStr = format(new Date(outcome.createdAt), 'yyyy-MM-dd');
    const resultLabel = OUTCOME_LABEL[outcome.result] ?? outcome.result;
    let resultLine = `> **결과 (${dateStr})**: ${resultLabel}`;
    if (outcome.reflection) resultLine += `. ${outcome.reflection}`;
    lines.push(resultLine);
  }

  lines.push('');
  return lines;
}

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
  } else if (entry.mode !== 'silent') {
    // STT 미완료 클립이 같은 날 다른 클립의 export에 휩쓸려 렌더되는 경우.
    // 해당 클립의 STT가 끝나면 자체 export 잡이 이 날을 재생성하며 대체된다.
    lines.push(entry.sttStatus === 'failed' ? '*음성 인식 실패*' : '*음성 처리 중…*', '');
  }

  // 메모
  if (entry.manualNote?.trim()) {
    if (transcriptText) lines.push('---', '');
    lines.push(entry.manualNote.trim(), '');
  }

  // 결정 callout (confirmed/edited만 — ADR-006/014, ADR-016)
  for (const decisionItem of item.decisions) {
    lines.push(...buildDecisionCallout(decisionItem));
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

// ─── ADR-026 3단계: 빈 날 데일리 노트 정리 ────────────────────────────────────

/**
 * vault에서 해당 날짜의 빈 데일리 노트(.md)를 삭제한다 (idempotent).
 *
 * 호출 시점: entry soft delete 후 그 날의 남은 entry가 0개일 때 worker가 호출.
 * 파일 경로: SnackShot/entries/YYYY/MM/YYYY-MM-DD.md
 *
 * boundaryHour를 사용해 recordedAt → logicalDate('yyyy-MM-dd')를 계산하므로
 * export.ts의 buildDayMarkdown/exportDay와 동일한 키로 파일을 식별한다.
 *
 * 파일이 없거나 SAF 권한이 만료된 경우 console.warn 후 계속 — 호출자(워커)는
 * 잡 성공으로 처리하고 다음으로 넘어가야 한다.
 */
export function deleteEmptyDayNote(
  vaultDir: Directory,
  recordedAt: number,
  boundaryHour: number,
): void {
  // boundaryHour만큼 뒤로 shift → 논리적 하루의 자정으로 매핑 (entries 카운트와 동일 규칙)
  const logicalDate = format(
    new Date(recordedAt - boundaryHour * 3_600_000),
    'yyyy-MM-dd',
  );
  const yyyy = logicalDate.slice(0, 4);
  const mm = logicalDate.slice(5, 7);
  const fileName = `${logicalDate}.md`;

  // SnackShot/entries/YYYY/MM/<file>.md tree-doc URI 단계적 구성
  const vaultUri = vaultDir.uri;
  const snackUri = buildChildTreeDocUri(vaultUri, 'SnackShot');
  if (!snackUri) return;
  const entriesUri = buildChildTreeDocUri(snackUri, 'entries');
  if (!entriesUri) return;
  const yearUri = buildChildTreeDocUri(entriesUri, yyyy);
  if (!yearUri) return;
  const monthUri = buildChildTreeDocUri(yearUri, mm);
  if (!monthUri) return;
  const fileUri = buildChildTreeDocUri(monthUri, fileName);
  if (!fileUri) return;

  try {
    const f = new File(fileUri);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn(`[obsidian] deleteEmptyDayNote failed for ${fileName}:`, e);
  }
}
