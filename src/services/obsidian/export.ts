/**
 * 옵시디언 export 엔진 (ADR-026 2단계).
 *
 * 경로 구조:
 *   [vault]/SnackShot/
 *     entries/YYYY/MM/YYYY-MM-DD-snackshot.md   ← 하루당 1개 데일리 노트
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
 *
 * ⚠️ write 대상 File은 반드시 Directory.createFile()이 반환한 SAF-native 핸들이어야
 *    한다. raw URI로 만든 `new File(safUri)`에 write하면 네이티브가 create()를
 *    호출해 "create function does not work with SAF Uris"로 throw한다. (vault.ts 참고)
 */

import { format } from 'date-fns';
import { Directory, File } from 'expo-file-system';

import type { DecisionCategory, EntryMode, OutcomeResult } from '@/types/domain';
import type { DayExportItem, DecisionExportItem, ObsidianExportService } from './types';
import {
  assertVaultWritable,
  buildChildTreeDocUri,
  type SAFDir,
  safGetOrCreateDir,
  safGetOrCreateFile,
  safSafeExists,
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
  text: '메모',
  photo: '사진',
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

// Obsidian callout — 각 줄은 '> '로 시작해야 callout 블록으로 인식됨.
// D3-a: 상황/이유/기대/확신도/교훈을 있을 때만 추가하고, 제목 다음 줄에 Dataview
// 인라인 필드(> [category:: X] [confidence:: Y] [result:: Z])를 넣어 쿼리 가능하게 한다.
// (test 스냅샷을 위해 export)
export function buildDecisionCallout(item: DecisionExportItem): string[] {
  const { decision, outcome } = item;
  const summary = decision.userSummary ?? decision.summary;
  const category = decision.userCategory ?? decision.category;
  const catLabel = CATEGORY_LABEL[category] ?? category;
  const situation = decision.userSituation ?? decision.situation;
  const reasoning = decision.userReasoning ?? decision.reasoning;

  const lines: string[] = [
    `> [!decision] ${summary} (${catLabel})`,
  ];

  // Dataview 인라인 필드 — 제목 바로 다음 줄. category/confidence 항상, result는 회고 있을 때만.
  const dvFields = [`category:: ${catLabel}`, `confidence:: ${decision.confidence}`];
  if (outcome) dvFields.push(`result:: ${outcome.result}`);
  lines.push(`> [${dvFields.join('] [')}]`);

  if (situation) {
    lines.push(`> **상황**: ${situation}`);
  }

  if (decision.evidenceQuote) {
    lines.push(`> **근거**: ${decision.evidenceQuote}`);
  }

  if (reasoning) {
    lines.push(`> **이유**: ${reasoning}`);
  }

  if (decision.expectedOutcome) {
    lines.push(`> **기대**: ${decision.expectedOutcome}`);
  }

  // confidence는 NOT NULL이라 항상 표기(%).
  lines.push(`> **확신도**: ${Math.round(decision.confidence * 100)}%`);

  if (decision.followUpAt) {
    lines.push(`> **후속 확인**: ${format(new Date(decision.followUpAt), 'yyyy-MM-dd')}`);
  }

  if (outcome) {
    const dateStr = format(new Date(outcome.createdAt), 'yyyy-MM-dd');
    const resultLabel = OUTCOME_LABEL[outcome.result] ?? outcome.result;
    let resultLine = `> **결과 (${dateStr})**: ${resultLabel}`;
    if (outcome.reflection) resultLine += `. ${outcome.reflection}`;
    lines.push(resultLine);
    if (outcome.learnings) {
      lines.push(`> **교훈**: ${outcome.learnings}`);
    }
  }

  lines.push('');
  return lines;
}

function buildEntrySection(item: DayExportItem, mediaVaultPath: string): string[] {
  const { entry, transcript } = item;

  // text 모드는 미디어/길이가 없으므로 헤더에서 길이 표기를 생략한다.
  const headerSuffix = entry.mode === 'text'
    ? ''
    : ` (${formatDuration(entry.durationMs)})`;
  const lines: string[] = [
    `## ${format(new Date(entry.recordedAt), 'HH:mm')} — ${MODE_LABEL[entry.mode]}${headerSuffix}`,
    `%% snackshot_id: ${entry.id} %%`,
    '',
  ];

  // 미디어 임베드 — 영상은 mp4만 임베드 (썸네일은 git용으로 복사만, 노트엔 중복 표시 방지).
  // text 모드는 미디어 파일이 없으므로 임베드 라인 자체를 생략한다.
  if ((entry.mode === 'voice' || entry.mode === 'silent') && entry.compressedPath) {
    lines.push(`![[${mediaVaultPath}/${entry.id}.mp4]]`, '');
  } else if (entry.mode === 'audio' && entry.originalPath) {
    lines.push(`![[${mediaVaultPath}/${entry.id}.m4a]]`, '');
  } else if (entry.mode === 'photo' && entry.compressedPath) {
    lines.push(`![[${mediaVaultPath}/${entry.id}.jpg]]`, '');
  }

  // 트랜스크립트 (editedText 우선 — ADR-016)
  const transcriptText = transcript?.editedText?.trim() ?? transcript?.rawText?.trim();
  if (transcriptText) {
    lines.push(transcriptText, '');
  } else if (entry.mode !== 'silent' && entry.mode !== 'text' && entry.mode !== 'photo') {
    // STT 미완료 클립이 같은 날 다른 클립의 export에 휩쓸려 렌더되는 경우.
    // 해당 클립의 STT가 끝나면 자체 export 잡이 이 날을 재생성하며 대체된다.
    // silent/text는 애초에 STT 대상이 아니므로 fallback 표시 금지.
    lines.push(
      entry.sttStatus === 'failed' ? '*음성 인식 실패*'
        : entry.sttStatus === 'skipped' ? '*음성 없음*'
          : '*음성 처리 중…*',
      '',
    );
  }

  // 메모 — text 모드는 본문이 manualNote에 들어있고, 위 분기에서 transcript가 없으므로
  // 자연스럽게 본문 텍스트만 렌더된다.
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
    // 상단 날짜를 그날 일기 노트로 가는 위키링크로 — 일기 ↔ 스냅샷 양방향 이동.
    // 일기 노트(YYYY-MM-DD.md)는 ![[YYYY-MM-DD-snackshot]]로 이 노트를 임베드/링크한다.
    `# [[${logicalDate}|📔 ${logicalDate} 일기]]`,
    '',
  ];
  for (const item of items) {
    lines.push(...buildEntrySection(item, mediaVaultPath));
  }
  return lines.join('\n');
}

// ─── SAF 미디어 복사 (bytesSync + write 방식 — File.copy는 SAF 미지원) ──────

/**
 * 로컬 미디어 파일을 SAF media 디렉토리로 복사한다.
 *
 * - 미디어는 ULID로 content-addressed → 같은 이름이 이미 있으면 내용도 동일하므로
 *   재작성하지 않고 skip한다. (불필요한 SAF write + 잠재적 create 충돌 회피)
 * - 새로 쓸 때는 반드시 mediaDir.createFile()이 반환한 쓰기 가능한 핸들에만 write한다.
 *   raw URI File에 write하면 SAF에서 create 에러로 throw한다.
 */
function copyLocalFileToSAF(
  mediaDir: SAFDir,
  name: string,
  mimeType: string,
  localPath: string,
): void {
  const src = new File(localPath);
  if (!safSafeExists(src)) return;

  const existingUri = buildChildTreeDocUri((mediaDir as Directory).uri, name);
  if (existingUri && safSafeExists(new File(existingUri))) {
    return; // 이미 복사됨 (content-addressed) — skip
  }

  const safFile = mediaDir.createFile(name, mimeType);
  safFile.write(src.bytesSync());
}

// ─── 구현체 ──────────────────────────────────────────────────────────────────

function exportDay(
  vaultDir: Directory,
  logicalDate: string,
  items: DayExportItem[],
): void {
  // write 전에 vault 존재·SAF 권한을 먼저 확인 (방어적).
  assertVaultWritable(vaultDir);

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
        copyLocalFileToSAF(mediaDir, `${entry.id}.mp4`, 'video/mp4', entry.compressedPath);
      }
      if (entry.thumbnailPath) {
        copyLocalFileToSAF(mediaDir, `${entry.id}.jpg`, 'image/jpeg', entry.thumbnailPath);
      }
    } else if (entry.mode === 'audio' && entry.originalPath) {
      copyLocalFileToSAF(mediaDir, `${entry.id}.m4a`, 'audio/mp4', entry.originalPath);
    } else if (entry.mode === 'photo' && entry.compressedPath) {
      copyLocalFileToSAF(mediaDir, `${entry.id}.jpg`, 'image/jpeg', entry.compressedPath);
    }
  }

  // ── 데일리 노트 재생성 ──
  const entriesDir = safGetOrCreateDir(
    safGetOrCreateDir(safGetOrCreateDir(snackShotDir, 'entries'), yyyy),
    mm,
  );
  const mdFile = safGetOrCreateFile(
    entriesDir,
    `${dailyNoteBaseName(logicalDate)}.md`,
    'text/markdown',
  );
  mdFile.write(buildDayMarkdown(logicalDate, items, mediaVaultPath));
}

export const obsidianExportService: ObsidianExportService = { exportDay };

// ─── 데일리 노트 파일명 ───────────────────────────────────────────────────────

/**
 * 데일리 노트의 확장자 없는 베이스 이름 (ADR-026 개정).
 *
 * '-snackshot' suffix를 붙이는 이유: 사용자의 기존 일기가 같은 베이스명
 * (YYYY-MM-DD.md)을 쓴다. 옵시디언 위키링크는 vault 전체에서 파일명으로
 * 해석되므로, 이름이 겹치면 일기의 [[YYYY-MM-DD]] 내비게이션 링크가
 * SnackShot 노트로 잘못 점프할 수 있다. 사용자 일기 템플릿은
 * ![[YYYY-MM-DD-snackshot]] 임베드로 이 노트를 인라인 표시한다.
 */
export function dailyNoteBaseName(logicalDate: string): string {
  return `${logicalDate}-snackshot`;
}

// ─── ADR-026 3단계: 빈 날 데일리 노트 정리 ────────────────────────────────────

/**
 * vault에서 해당 날짜의 빈 데일리 노트(.md)를 삭제한다 (idempotent).
 *
 * 호출 시점: entry soft delete 후 그 날의 남은 entry가 0개일 때 worker가 호출.
 * 파일 경로: SnackShot/entries/YYYY/MM/YYYY-MM-DD-snackshot.md
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
  const fileName = `${dailyNoteBaseName(logicalDate)}.md`;

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
