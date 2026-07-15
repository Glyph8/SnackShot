import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import {
  countDecisionsDueForFollowUp,
  countDeliberatingDue,
  countExtractedDecisions,
  enqueueJob,
  getActiveUpcomingDecisions,
  getDecisionsDueForFollowUp,
  getDeliberatingDecisions,
  getEntry,
  getPendingDecisions,
  getOutcomeByDecision,
  getPendingReflectionDecisions,
  getSettings,
  getSimilarPastDecisions,
  insertOutcome,
  markDecisionExecuted,
  setDecisionConfirmedNow,
  setDecisionFollowUp,
  softDeleteDecision,
  softDeleteOutcome,
  unmarkDecisionExecuted,
  updateDecisionStatus,
  updateUserEdit,
} from '@/db';
import { nowMs } from '@/lib/time';
import { cancelFollowUp, resyncFollowUpNotifications, syncFollowUpForDecision } from '@/services/followUpNotifications';
import { kickWorker } from '@/services/jobs/queue';
import type { SimilarPastItem } from '@/db';
import type { Decision, DecisionCategory, Entry, OutcomeResult } from '@/types/domain';

export interface DecisionWithEntry {
  decision: Decision;
  entry: Entry;
  /** F1: 확정 전 참고용 유사 과거 결정(열람 전용). pendingCandidates에만 부착된다. */
  similarPast?: SimilarPastItem[];
}

export interface EditParams {
  userSummary?: string;
  userCategory?: DecisionCategory;
  /** 커스텀 카테고리 라벨. 빌트인 선택 시 ''(빈 문자열)로 해제, 커스텀 선택 시 라벨 보존 */
  customCategory?: string;
  userSituation?: string;
  followUpAt?: number;
  /** F3: 본인 입력 확신도(0~1) */
  userConfidence?: number;
}

export type InboxViewMode = 'deck' | 'board' | 'list';

// 회고 대기 윈도우 — 수행 완료 후 이 기간 동안만 결과 입력을 권유 (v8 Phase 4)
const REFLECTION_WINDOW_MS = 7 * 86_400_000;
// F4: 재후속 지연 — "아직 이르다" 선택 시 7일 뒤 다시 물어본다.
const REFOLLOW_DELAY_MS = 7 * 86_400_000;

interface InboxState {
  pendingCandidates: DecisionWithEntry[];
  dueFollowUps: DecisionWithEntry[];
  upcomingDecisions: DecisionWithEntry[];
  reflectionDecisions: DecisionWithEntry[];
  deliberatingDecisions: DecisionWithEntry[];
  loading: boolean;
  badgeCount: number;
  viewMode: InboxViewMode;
  setViewMode(mode: InboxViewMode): void;

  loadInbox(db: SQLiteDatabase): Promise<void>;
  loadBadge(db: SQLiteDatabase): Promise<void>;
  confirmDecision(db: SQLiteDatabase, id: string, edits?: EditParams): Promise<void>;
  /** 이미 확정된 결정(보드)의 사용자 편집 — 상태 변경 없이 user_* 갱신 후 보드 리로드 */
  editDecision(db: SQLiteDatabase, id: string, edits: EditParams): Promise<void>;
  /** 덱에서 AI 추출 후보를 반려 — 무가치한 오추출이므로 저장하지 않고 소프트 삭제 (ADR-014) */
  discardCandidate(db: SQLiteDatabase, id: string): Promise<void>;
  rejectDecision(db: SQLiteDatabase, id: string): Promise<void>;
  recordOutcome(db: SQLiteDatabase, decisionId: string, result: OutcomeResult, reflection?: string, learnings?: string): Promise<void>;
  /** F4: unclear/mixed 결과의 잠정 판단을 되돌리고 7일 뒤 재확인으로 재예약 */
  reFollowDecision(db: SQLiteDatabase, id: string): Promise<void>;
  /** F5/ADR-028: 미결→확정 전이("결정했다") — EditDecisionSheet 편집 반영 + confirmed_at 기록 */
  decideDeliberating(db: SQLiteDatabase, id: string, edits: EditParams): Promise<void>;
  /** F5/ADR-028: 미결 접기(고민 접음) — soft delete(rejected 오용 금지) */
  discardDeliberating(db: SQLiteDatabase, id: string): Promise<void>;
  markExecuted(db: SQLiteDatabase, id: string): Promise<void>;
  unmarkExecuted(db: SQLiteDatabase, id: string): Promise<void>;
}

// vault 연결 시에만 해당 entry의 날을 obsidian_export로 재큐잉한다.
async function maybeEnqueueReExport(db: SQLiteDatabase, entryId: string): Promise<void> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) return;
  await enqueueJob(db, 'obsidian_export', entryId, 'entries');
  kickWorker();
  console.log(`[inbox] obsidian_export re-enqueued for entry=${entryId}`);
}

async function withEntries(
  db: SQLiteDatabase,
  decisions: Decision[],
): Promise<DecisionWithEntry[]> {
  const results: DecisionWithEntry[] = [];
  for (const decision of decisions) {
    const entry = await getEntry(db, decision.entryId);
    if (entry) results.push({ decision, entry });
  }
  return results;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  pendingCandidates: [],
  dueFollowUps: [],
  upcomingDecisions: [],
  reflectionDecisions: [],
  deliberatingDecisions: [],
  loading: false,
  badgeCount: 0,
  viewMode: 'board',
  setViewMode: (mode) => set({ viewMode: mode }),

  loadInbox: async (db) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const now = nowMs();
      const [pending, due, upcoming, reflection, deliberating] = await Promise.all([
        getPendingDecisions(db),
        getDecisionsDueForFollowUp(db, now),
        getActiveUpcomingDecisions(db, now),
        getPendingReflectionDecisions(db, now, REFLECTION_WINDOW_MS),
        getDeliberatingDecisions(db),
      ]);
      const [pendingItems, dueItems, upcomingItems, reflectionItems, deliberatingItems] = await Promise.all([
        withEntries(db, pending),
        withEntries(db, due),
        withEntries(db, upcoming),
        withEntries(db, reflection),
        withEntries(db, deliberating),
      ]);
      // F1: 검토 후보 각각에 유사 과거 결정을 부착(열람 전용). 후보 수가 적어 N회 쿼리 허용.
      const pendingWithSimilar = await Promise.all(
        pendingItems.map(async (it) => {
          try {
            const q = it.decision.userSummary ?? it.decision.summary;
            const similarPast = await getSimilarPastDecisions(db, q, {
              excludeEntryId: it.decision.entryId,
              limit: 3,
            });
            return { ...it, similarPast };
          } catch {
            return it;
          }
        }),
      );
      // I2: 마감 도래 미결(decide_by <= now)만 Inbox 배지에 포함(미도래는 결정 탭 소관).
      const dueDeliberating = deliberatingItems.filter(
        (i) => i.decision.decideBy != null && i.decision.decideBy <= now,
      ).length;
      set({
        pendingCandidates: pendingWithSimilar,
        dueFollowUps: dueItems,
        upcomingDecisions: upcomingItems,
        reflectionDecisions: reflectionItems,
        deliberatingDecisions: deliberatingItems,
        badgeCount: pendingWithSimilar.length + dueItems.length + dueDeliberating,
      });
    } catch (e) {
      console.error('[inbox] loadInbox failed', e);
    } finally {
      set({ loading: false });
    }
  },

  loadBadge: async (db) => {
    try {
      const now = nowMs();
      const [extracted, due, deliberatingDue] = await Promise.all([
        countExtractedDecisions(db),
        countDecisionsDueForFollowUp(db, now),
        countDeliberatingDue(db, now),
      ]);
      set({ badgeCount: extracted + due + deliberatingDue });
    } catch (e) {
      console.error('[inbox] loadBadge failed', e);
    }
  },

  confirmDecision: async (db, id, edits) => {
    const item = get().pendingCandidates.find((i) => i.decision.id === id);
    set((s) => ({
      pendingCandidates: s.pendingCandidates.filter((i) => i.decision.id !== id),
    }));
    if (edits) {
      await updateUserEdit(db, id, {
        userSummary: edits.userSummary,
        userCategory: edits.userCategory,
        customCategory: edits.customCategory,
        userSituation: edits.userSituation,
        userConfidence: edits.userConfidence,
        followUpAt: edits.followUpAt,
        followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
      });
    }
    // ADR-006: 사용자가 수정해서 확정하면 'edited', 그대로 확정하면 'confirmed'
    await updateDecisionStatus(db, id, edits ? 'edited' : 'confirmed');
    await syncFollowUpForDecision(db, id);
    if (item) await maybeEnqueueReExport(db, item.entry.id);
    await get().loadBadge(db);
  },

  // 보드 카드 탭 → 결정 수정 (decisions.tsx handleEditSave와 동일 경로).
  // 확정 상태는 유지하고 user_* 컬럼만 갱신(ADR-016 원본 보존) 후 보드를 다시 읽는다.
  editDecision: async (db, id, edits) => {
    const s0 = get();
    const item =
      s0.upcomingDecisions.find((i) => i.decision.id === id) ??
      s0.reflectionDecisions.find((i) => i.decision.id === id) ??
      s0.dueFollowUps.find((i) => i.decision.id === id);
    await updateUserEdit(db, id, {
      userSummary: edits.userSummary,
      userCategory: edits.userCategory,
      customCategory: edits.customCategory,
      userSituation: edits.userSituation,
      userConfidence: edits.userConfidence,
      followUpAt: edits.followUpAt,
      followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
    });
    await syncFollowUpForDecision(db, id);
    if (item) await maybeEnqueueReExport(db, item.entry.id);
    await get().loadInbox(db);
  },

  // 덱 반려 — 미확정 AI 추출 후보는 'rejected'로 남기지 않고 소프트 삭제해
  // 목록·통계에서 제외한다 (AI 오추출이 대부분이라 저장 가치가 없음, ADR-014).
  discardCandidate: async (db, id) => {
    set((s) => ({
      pendingCandidates: s.pendingCandidates.filter((i) => i.decision.id !== id),
    }));
    await softDeleteDecision(db, id);
    await cancelFollowUp(id);
    await get().loadBadge(db);
  },

  rejectDecision: async (db, id) => {
    set((s) => ({
      pendingCandidates: s.pendingCandidates.filter((i) => i.decision.id !== id),
    }));
    await updateDecisionStatus(db, id, 'rejected');
    await cancelFollowUp(id);
    await get().loadBadge(db);
  },

  // 결과(good/bad 등) 기록 = 마무리. 후속 확인·진행 중·회고 대기 어디서 호출돼도 동작한다.
  // executed_at도 멱등 보장(없으면 기록) → 결과 입력만으로도 보드에서 빠진다. (v8 Phase 4)
  recordOutcome: async (db, decisionId, result, reflection, learnings) => {
    const s0 = get();
    const item =
      s0.dueFollowUps.find((i) => i.decision.id === decisionId) ??
      s0.upcomingDecisions.find((i) => i.decision.id === decisionId) ??
      s0.reflectionDecisions.find((i) => i.decision.id === decisionId);
    set((s) => ({
      dueFollowUps: s.dueFollowUps.filter((i) => i.decision.id !== decisionId),
      upcomingDecisions: s.upcomingDecisions.filter((i) => i.decision.id !== decisionId),
      reflectionDecisions: s.reflectionDecisions.filter((i) => i.decision.id !== decisionId),
    }));
    await markDecisionExecuted(db, decisionId); // executed_at 멱등 — 이미 있으면 유지
    await insertOutcome(db, {
      decisionId, result,
      reflection: reflection?.trim() || undefined,
      learnings: learnings?.trim() || undefined,
    });
    await cancelFollowUp(decisionId);
    if (item) await maybeEnqueueReExport(db, item.entry.id);
    await get().loadBadge(db);
  },

  // F5/ADR-028: 미결→확정 전이 — updateUserEdit(status='edited'+필드) 후 confirmed_at 기록·알림 sync.
  decideDeliberating: async (db, id, edits) => {
    const item = get().deliberatingDecisions.find((i) => i.decision.id === id);
    await updateUserEdit(db, id, {
      userSummary: edits.userSummary,
      userCategory: edits.userCategory,
      customCategory: edits.customCategory,
      userSituation: edits.userSituation,
      userConfidence: edits.userConfidence,
      followUpAt: edits.followUpAt,
      followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
    });
    await setDecisionConfirmedNow(db, id);
    await syncFollowUpForDecision(db, id);
    // 전이로 비로소 export 대상이 된다(미결 저장은 건너뛰었음) — 화면의 obsidianPrompt와 정합.
    if (item) await maybeEnqueueReExport(db, item.entry.id);
    await get().loadInbox(db);
  },

  // F5/ADR-028: 미결 접기 — soft delete(ADR-014). rejected는 '결정 아님' 의미라 오용하지 않는다.
  discardDeliberating: async (db, id) => {
    set((s) => ({
      deliberatingDecisions: s.deliberatingDecisions.filter((i) => i.decision.id !== id),
    }));
    await softDeleteDecision(db, id);
    await cancelFollowUp(id);
    await get().loadInbox(db);
  },

  // F4: 재후속 — 잠정(unclear/mixed) 판단을 되돌린다. recordOutcome이 남긴 executed_at·outcome을
  // 되돌리지 않으면 보드/알림 어디에도 재등장하지 못하므로(코드 정합), 함께 정리한다.
  //   ① 최신 outcome soft-delete ② executed_at clear ③ follow_up_at=+7일·set_by='refollow' ④ resync
  reFollowDecision: async (db, id) => {
    const outcome = await getOutcomeByDecision(db, id);
    if (outcome) await softDeleteOutcome(db, outcome.id);
    await unmarkDecisionExecuted(db, id);
    await setDecisionFollowUp(db, id, nowMs() + REFOLLOW_DELAY_MS, 'refollow');
    await resyncFollowUpNotifications(db);
    await get().loadInbox(db);
  },

  // 결정 보드 "수행 완료" 체크(결과 없이) — 진행 중에서 빼고 회고 대기(압축 체크행)로 이동 (v8 Phase 2/4)
  markExecuted: async (db, id) => {
    const item = get().upcomingDecisions.find((i) => i.decision.id === id);
    const executedAt = nowMs();
    set((s) => ({
      upcomingDecisions: s.upcomingDecisions.filter((i) => i.decision.id !== id),
      reflectionDecisions: item
        ? [{ ...item, decision: { ...item.decision, executedAt } }, ...s.reflectionDecisions]
        : s.reflectionDecisions,
    }));
    await markDecisionExecuted(db, id);
    await get().loadBadge(db);
  },

  // 체크 취소 — 압축 체크행을 다시 "진행 중"으로 되돌린다 (v8 Phase 4.1)
  unmarkExecuted: async (db, id) => {
    const item = get().reflectionDecisions.find((i) => i.decision.id === id);
    set((s) => ({
      reflectionDecisions: s.reflectionDecisions.filter((i) => i.decision.id !== id),
      upcomingDecisions: item
        ? [{ ...item, decision: { ...item.decision, executedAt: undefined } }, ...s.upcomingDecisions]
        : s.upcomingDecisions,
    }));
    await unmarkDecisionExecuted(db, id);
    await get().loadBadge(db);
  },
}));
