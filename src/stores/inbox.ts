import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import {
  countDecisionsDueForFollowUp,
  countExtractedDecisions,
  enqueueJob,
  getActiveUpcomingDecisions,
  getDecisionsDueForFollowUp,
  getEntry,
  getPendingDecisions,
  getPendingReflectionDecisions,
  getSettings,
  insertOutcome,
  markDecisionExecuted,
  unmarkDecisionExecuted,
  updateDecisionStatus,
  updateUserEdit,
} from '@/db';
import { nowMs } from '@/lib/time';
import { kickWorker } from '@/services/jobs/queue';
import type { Decision, DecisionCategory, Entry, OutcomeResult } from '@/types/domain';

export interface DecisionWithEntry {
  decision: Decision;
  entry: Entry;
}

export interface EditParams {
  userSummary?: string;
  userCategory?: DecisionCategory;
  userSituation?: string;
  followUpAt?: number;
}

export type InboxViewMode = 'deck' | 'board';

// 회고 대기 윈도우 — 수행 완료 후 이 기간 동안만 결과 입력을 권유 (v8 Phase 4)
const REFLECTION_WINDOW_MS = 7 * 86_400_000;

interface InboxState {
  pendingCandidates: DecisionWithEntry[];
  dueFollowUps: DecisionWithEntry[];
  upcomingDecisions: DecisionWithEntry[];
  reflectionDecisions: DecisionWithEntry[];
  loading: boolean;
  badgeCount: number;
  viewMode: InboxViewMode;
  setViewMode(mode: InboxViewMode): void;

  loadInbox(db: SQLiteDatabase): Promise<void>;
  loadBadge(db: SQLiteDatabase): Promise<void>;
  confirmDecision(db: SQLiteDatabase, id: string, edits?: EditParams): Promise<void>;
  rejectDecision(db: SQLiteDatabase, id: string): Promise<void>;
  recordOutcome(db: SQLiteDatabase, decisionId: string, result: OutcomeResult, reflection?: string): Promise<void>;
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
  loading: false,
  badgeCount: 0,
  viewMode: 'deck',
  setViewMode: (mode) => set({ viewMode: mode }),

  loadInbox: async (db) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const now = nowMs();
      const [pending, due, upcoming, reflection] = await Promise.all([
        getPendingDecisions(db),
        getDecisionsDueForFollowUp(db, now),
        getActiveUpcomingDecisions(db, now),
        getPendingReflectionDecisions(db, now, REFLECTION_WINDOW_MS),
      ]);
      const [pendingItems, dueItems, upcomingItems, reflectionItems] = await Promise.all([
        withEntries(db, pending),
        withEntries(db, due),
        withEntries(db, upcoming),
        withEntries(db, reflection),
      ]);
      set({
        pendingCandidates: pendingItems,
        dueFollowUps: dueItems,
        upcomingDecisions: upcomingItems,
        reflectionDecisions: reflectionItems,
        badgeCount: pendingItems.length + dueItems.length,
      });
    } catch (e) {
      console.error('[inbox] loadInbox failed', e);
    } finally {
      set({ loading: false });
    }
  },

  loadBadge: async (db) => {
    try {
      const [extracted, due] = await Promise.all([
        countExtractedDecisions(db),
        countDecisionsDueForFollowUp(db, nowMs()),
      ]);
      set({ badgeCount: extracted + due });
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
        userSituation: edits.userSituation,
        followUpAt: edits.followUpAt,
        followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
      });
    }
    // ADR-006: 사용자가 수정해서 확정하면 'edited', 그대로 확정하면 'confirmed'
    await updateDecisionStatus(db, id, edits ? 'edited' : 'confirmed');
    if (item) await maybeEnqueueReExport(db, item.entry.id);
    await get().loadBadge(db);
  },

  rejectDecision: async (db, id) => {
    set((s) => ({
      pendingCandidates: s.pendingCandidates.filter((i) => i.decision.id !== id),
    }));
    await updateDecisionStatus(db, id, 'rejected');
    await get().loadBadge(db);
  },

  // 결과(good/bad 등) 기록 = 마무리. 후속 확인·진행 중·회고 대기 어디서 호출돼도 동작한다.
  // executed_at도 멱등 보장(없으면 기록) → 결과 입력만으로도 보드에서 빠진다. (v8 Phase 4)
  recordOutcome: async (db, decisionId, result, reflection) => {
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
    await insertOutcome(db, { decisionId, result, reflection: reflection?.trim() || undefined });
    if (item) await maybeEnqueueReExport(db, item.entry.id);
    await get().loadBadge(db);
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
