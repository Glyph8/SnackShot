import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import {
  loadHistory, recordAiRewrite, recordManualEdit, recordRestore,
  type DecisionTextField, type RevisionContext, type RevisionTarget,
} from '@/services/textRevision';
import type { TextRevision } from '@/types/domain';

export interface UseTextRevisionOpts {
  target: RevisionTarget;
  /** AI 원본 — baseline 시드용 */
  aiOriginal: string;
  /** 현재 표시값(시작값) */
  initialCurrent: string;
  /** Gemini 프롬프트용 대상 라벨 */
  targetLabel: string;
  /** 변경(수동/재작성/복원)이 적용된 뒤 새 본문을 부모에 알림 */
  onApplied?: (content: string) => void;
}

// 전사·결정 텍스트의 버전 관리 상태/액션을 캡슐화 (v10).
// ⚠️ target 객체는 부모가 매 렌더 새로 만들 수 있으므로, 메모 의존성은 원시 키
//    (kind·targetId·field)만 쓰고 target은 그 키들로 재구성한다(재렌더 루프 방지).
export function useTextRevision(opts: UseTextRevisionOpts) {
  const { target, aiOriginal, initialCurrent, targetLabel, onApplied } = opts;
  const db = useSQLiteContext();

  const kind = target.kind;
  const targetId = target.kind === 'transcript' ? target.transcriptId : target.decisionId;
  const field = target.kind === 'transcript' ? 'text' : target.field;

  const [history, setHistory] = useState<TextRevision[]>([]);
  const [current, setCurrent] = useState(initialCurrent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildTarget = useCallback((): RevisionTarget => (
    kind === 'transcript'
      ? { kind: 'transcript', transcriptId: targetId }
      : { kind: 'decision', decisionId: targetId, field: field as DecisionTextField }
  ), [kind, targetId, field]);

  const refresh = useCallback(async () => {
    setHistory(await loadHistory(db, buildTarget()));
  }, [db, buildTarget]);

  useEffect(() => { refresh(); }, [refresh]);

  const finish = useCallback((content: string, hist: TextRevision[]) => {
    setCurrent(content);
    setHistory(hist);
    onApplied?.(content);
  }, [onApplied]);

  const ctxFor = useCallback((cur: string): RevisionContext => ({
    target: buildTarget(), aiOriginal, current: cur, targetLabel,
  }), [buildTarget, aiOriginal, targetLabel]);

  const saveManual = useCallback(async (content: string) => {
    setBusy(true); setError(null);
    try {
      finish(content, await recordManualEdit(db, ctxFor(current), content));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [db, ctxFor, current, finish]);

  const rewrite = useCallback(async (instruction: string) => {
    setBusy(true); setError(null);
    try {
      const { content, history: hist } = await recordAiRewrite(db, ctxFor(current), instruction);
      finish(content, hist);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [db, ctxFor, current, finish]);

  const restore = useCallback(async (rev: TextRevision) => {
    setBusy(true); setError(null);
    try {
      finish(rev.content, await recordRestore(db, ctxFor(current), rev.content));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [db, ctxFor, current, finish]);

  return { history, current, busy, error, refresh, saveManual, rewrite, restore };
}
