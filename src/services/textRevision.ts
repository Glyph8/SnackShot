/**
 * 텍스트 리비전 오케스트레이션 (v10) — SoT.
 *
 * 전사·결정 텍스트의 모든 변경(수동 수정 / AI 재작성 / 버전 복원)을 한 경로로 처리한다:
 *   1) baseline 시드: 그 필드의 첫 변경이면 AI 원본을 'ai_original' 리비전으로 남긴다.
 *   2) 새 리비전 append (source별: manual / ai_rewrite / restore).
 *   3) 엔티티의 "현재값" 컬럼 동기화 — 표시·검색·내보내기 경로는 기존대로
 *      (transcript.edited_text ?? raw_text, decision.user_* ?? ai)를 읽으므로
 *      현재값만 맞춰주면 된다.
 *
 * "현재값 = 최신 리비전 content" 불변식을 유지해 다단계 롤백이 단순해진다.
 * obsidian 재내보내기 등 부수효과는 호출 화면이 담당한다(여기선 데이터만).
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  countTextRevisions, getTextRevisions, insertTextRevision,
  updateEditedText, updateUserEdit,
} from '@/db';
import { getLabelService } from '@/services/label';
import type { TextRevision, TextRevisionSource } from '@/types/domain';

// 결정에서 버전 관리하는 텍스트 필드 — user_* 컬럼이 있는 것만.
export type DecisionTextField = 'summary' | 'situation' | 'reasoning';

export type RevisionTarget =
  | { kind: 'transcript'; transcriptId: string }
  | { kind: 'decision'; decisionId: string; field: DecisionTextField };

export interface RevisionContext {
  target: RevisionTarget;
  /** AI 원본 — baseline('ai_original') 시드용 */
  aiOriginal: string;
  /** 현재 표시값 — AI 재작성의 입력 원본 */
  current: string;
  /** Gemini 프롬프트에 줄 사람이 읽는 대상 라벨(예: '음성 전사(STT)', '의사결정 요약') */
  targetLabel: string;
}

function targetIdOf(t: RevisionTarget): string {
  return t.kind === 'transcript' ? t.transcriptId : t.decisionId;
}

function fieldOf(t: RevisionTarget): string {
  return t.kind === 'transcript' ? 'text' : t.field;
}

// 엔티티의 "현재값" 컬럼을 content로 동기화.
async function writeCurrent(
  db: SQLiteDatabase,
  target: RevisionTarget,
  content: string,
): Promise<void> {
  if (target.kind === 'transcript') {
    await updateEditedText(db, target.transcriptId, content);
    return;
  }
  if (target.field === 'summary') {
    await updateUserEdit(db, target.decisionId, { userSummary: content });
  } else if (target.field === 'situation') {
    await updateUserEdit(db, target.decisionId, { userSituation: content });
  } else {
    await updateUserEdit(db, target.decisionId, { userReasoning: content });
  }
}

async function ensureBaseline(db: SQLiteDatabase, ctx: RevisionContext): Promise<void> {
  const kind = ctx.target.kind;
  const targetId = targetIdOf(ctx.target);
  const field = fieldOf(ctx.target);
  const n = await countTextRevisions(db, kind, targetId, field);
  if (n === 0) {
    await insertTextRevision(db, {
      targetKind: kind, targetId, field,
      content: ctx.aiOriginal, source: 'ai_original',
    });
  }
}

// 공통: baseline 시드 → 리비전 append → 현재값 동기화 → 최신 이력 반환.
async function apply(
  db: SQLiteDatabase,
  ctx: RevisionContext,
  content: string,
  source: TextRevisionSource,
  instruction?: string,
): Promise<TextRevision[]> {
  await ensureBaseline(db, ctx);
  await insertTextRevision(db, {
    targetKind: ctx.target.kind,
    targetId: targetIdOf(ctx.target),
    field: fieldOf(ctx.target),
    content,
    source,
    instruction,
  });
  await writeCurrent(db, ctx.target, content);
  return getTextRevisions(db, ctx.target.kind, targetIdOf(ctx.target), fieldOf(ctx.target));
}

export async function loadHistory(
  db: SQLiteDatabase,
  target: RevisionTarget,
): Promise<TextRevision[]> {
  return getTextRevisions(db, target.kind, targetIdOf(target), fieldOf(target));
}

// 직접 수정한 텍스트를 저장.
export async function recordManualEdit(
  db: SQLiteDatabase,
  ctx: RevisionContext,
  content: string,
): Promise<TextRevision[]> {
  return apply(db, ctx, content, 'manual');
}

// 사용자 지침으로 Gemini 재작성 → 즉시 적용. 반환값에 새 본문 포함.
export async function recordAiRewrite(
  db: SQLiteDatabase,
  ctx: RevisionContext,
  instruction: string,
): Promise<{ content: string; history: TextRevision[] }> {
  const content = await getLabelService().rewriteText({
    targetLabel: ctx.targetLabel,
    original: ctx.current,
    instruction,
  });
  const history = await apply(db, ctx, content, 'ai_rewrite', instruction);
  return { content, history };
}

// 과거 버전으로 되돌리기 — 그 버전 내용을 새 'restore' 리비전으로 현재화한다.
export async function recordRestore(
  db: SQLiteDatabase,
  ctx: RevisionContext,
  content: string,
): Promise<TextRevision[]> {
  return apply(db, ctx, content, 'restore');
}
