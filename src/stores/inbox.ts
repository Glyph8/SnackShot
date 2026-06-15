import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import {
  countDecisionsDueForFollowUp,
  countExtractedDecisions,
  enqueueJob,
  getDecisionsDueForFollowUp,
  getEntry,
  getPendingDecisions,
  getSettings,
  insertOutcome,
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
  followUpAt?: number;
}

export type InboxViewMode = 'deck' | 'list';

interface InboxState {
  pendingCandidates: DecisionWithEntry[];
  dueFollowUps: DecisionWithEntry[];
  loading: boolean;
  badgeCount: number;
  viewMode: InboxViewMode;
  setViewMode(mode: InboxViewMode): void;

  loadInbox(db: SQLiteDatabase): Promise<void>;
  loadBadge(db: SQLiteDatabase): Promise<void>;
  confirmDecision(db: SQLiteDatabase, id: string, edits?: EditParams): Promise<void>;
  rejectDecision(db: SQLiteDatabase, id: string): Promise<void>;
  recordOutcome(db: SQLiteDatabase, decisionId: string, result: OutcomeResult): Promise<void>;
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
  loading: false,
  badgeCount: 0,
  viewMode: 'deck',
  setViewMode: (mode) => set({ viewMode: mode }),

  loadInbox: async (db) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const now = nowMs();
      const [pending, due] = await Promise.all([
        getPendingDecisions(db),
        getDecisionsDueForFollowUp(db, now),
      ]);
      const [pendingItems, dueItems] = await Promise.all([
        withEntries(db, pending),
        withEntries(db, due),
      ]);
      set({
        pendingCandidates: pendingItems,
        dueFollowUps: dueItems,
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

  recordOutcome: async (db, decisionId, result) => {
    const item = get().dueFollowUps.find((i) => i.decision.id === decisionId);
    set((s) => ({
      dueFollowUps: s.dueFollowUps.filter((i) => i.decision.id !== decisionId),
    }));
    await insertOutcome(db, { decisionId, result });
    if (item) await maybeEnqueueReExport(db, item.entry.id);
    await get().loadBadge(db);
  },
}));
