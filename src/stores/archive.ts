import { addHours, addMonths, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import {
  countEntriesByMonth,
  getEntriesByDay,
  getEntriesPage,
  getLatestTranscript,
  getOnThisDay,
  getPrimaryDecisionForEntry,
  getSettings,
  searchTranscripts,
} from '@/db';
import type { SearchFilters, SearchResult } from '@/db/repos/transcripts';
import { getDayBoundary } from '@/lib/time';
import { type DeleteEntryOptions, deleteEntryWithCleanup } from '@/services/deleteEntry';
import type { Decision, Entry, Transcript } from '@/types/domain';

export interface EntryWithTranscript {
  entry: Entry;
  transcript: Transcript | null;
  // text 엔트리의 대표 결정(확정/수정). 있으면 '의사결정', 없으면 '메모'. (Archive 표시·라우팅)
  decision?: Decision | null;
}

interface ArchiveState {
  // ── 캘린더 ─────────────────────────────────────────────────────────────────
  currentMonth: string;
  entriesByDate: Record<string, number>;
  selectedDate: string | null;
  selectedEntries: EntryWithTranscript[];
  loading: boolean;
  selectedLoading: boolean;
  vaultConnected: boolean;

  loadMonth: (db: SQLiteDatabase, yearMonth: string) => Promise<void>;
  selectDate: (db: SQLiteDatabase, dateStr: string | null) => Promise<void>;

  // ── 검색 ────────────────────────────────────────────────────────────────────
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchHistory: string[]; // 최근 5개, 세션 한정 (영구 저장 X)

  setSearchQuery: (db: SQLiteDatabase, query: string) => void;
  clearSearch: () => void;
  removeHistory: (query: string) => void;
  deleteEntry: (db: SQLiteDatabase, entry: Entry, opts: DeleteEntryOptions) => Promise<void>;

  // ── 검색 필터(칩) ───────────────────────────────────────────────────────────
  searchFilters: SearchFilters;
  setSearchFilters: (db: SQLiteDatabase, partial: Partial<SearchFilters>) => void;

  // ── 타임라인(역시간순 연속 피드) ─────────────────────────────────────────────
  timelineItems: EntryWithTranscript[];
  timelineLoading: boolean;
  timelineHasMore: boolean;
  loadTimeline: (db: SQLiteDatabase) => Promise<void>;
  loadMoreTimeline: (db: SQLiteDatabase) => Promise<void>;

  // ── On This Day(작년 오늘 회상) ──────────────────────────────────────────────
  onThisDay: Entry[];
  loadOnThisDay: (db: SQLiteDatabase) => Promise<void>;
}

const TIMELINE_PAGE = 20;

// 엔트리에 transcript·대표 결정을 붙여 표시용 객체로 변환(selectDate/타임라인 공통).
async function hydrate(db: SQLiteDatabase, entries: Entry[]): Promise<EntryWithTranscript[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      entry,
      transcript: await getLatestTranscript(db, entry.id),
      decision: entry.mode === 'text' ? await getPrimaryDecisionForEntry(db, entry.id) : null,
    })),
  );
}

// 모듈 레벨 디바운스 타이머 (store 인스턴스와 함께 단 1개 존재)
let _searchTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_HISTORY = 5;

function pushHistory(history: string[], query: string): string[] {
  const q = query.trim();
  const deduped = history.filter((h) => h !== q);
  return [q, ...deduped].slice(0, MAX_HISTORY);
}

export const useArchiveStore = create<ArchiveState>((set, get) => ({
  // ── 캘린더 초기값 ───────────────────────────────────────────────────────────
  currentMonth: format(new Date(), 'yyyy-MM'),
  entriesByDate: {},
  selectedDate: null,
  selectedEntries: [],
  loading: false,
  selectedLoading: false,
  vaultConnected: false,

  loadMonth: async (db, yearMonth) => {
    if (get().loading) return;
    set({ loading: true, currentMonth: yearMonth, selectedDate: null, selectedEntries: [] });
    try {
      const settings = await getSettings(db);
      const { dayBoundaryHour } = settings;
      const [year, month] = yearMonth.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const startMs = addHours(startOfMonth(monthDate), dayBoundaryHour).getTime();
      const endMs = addHours(addMonths(startOfMonth(monthDate), 1), dayBoundaryHour).getTime();
      const counts = await countEntriesByMonth(db, startMs, endMs, dayBoundaryHour);
      set({ entriesByDate: counts, vaultConnected: !!settings.obsidianVaultUri });
    } catch (e) {
      console.error('[archive] loadMonth failed', e);
    } finally {
      set({ loading: false });
    }
  },

  selectDate: async (db, dateStr) => {
    if (!dateStr) {
      set({ selectedDate: null, selectedEntries: [] });
      return;
    }
    set({ selectedDate: dateStr, selectedLoading: true, selectedEntries: [] });
    try {
      const { dayBoundaryHour } = await getSettings(db);
      const noonMs = addHours(startOfDay(parseISO(dateStr)), 12).getTime();
      const { start, end } = getDayBoundary(noonMs, dayBoundaryHour);
      const entries = await getEntriesByDay(db, start, end);
      const withTranscripts = await Promise.all(
        entries.map(async (entry) => ({
          entry,
          transcript: await getLatestTranscript(db, entry.id),
          // text 엔트리만 대표 결정 조회(메모/의사결정 구분 + 라우팅용). 그 외는 undefined.
          decision: entry.mode === 'text' ? await getPrimaryDecisionForEntry(db, entry.id) : null,
        })),
      );
      set({ selectedEntries: withTranscripts });
    } catch (e) {
      console.error('[archive] selectDate failed', e);
      set({ selectedEntries: [] });
    } finally {
      set({ selectedLoading: false });
    }
  },

  // ── 검색 초기값 ─────────────────────────────────────────────────────────────
  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  searchHistory: [],
  searchFilters: {},
  timelineItems: [],
  timelineLoading: false,
  timelineHasMore: true,
  onThisDay: [],

  setSearchQuery: (db, query) => {
    set({ searchQuery: query });

    if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }

    if (!query.trim()) {
      set({ searchResults: [], searchLoading: false });
      return;
    }

    set({ searchLoading: true });
    _searchTimer = setTimeout(async () => {
      _searchTimer = null;
      const trimmed = query.trim();
      // 타이머 도중 쿼리가 바뀌었으면 결과 무시
      if (get().searchQuery.trim() !== trimmed) return;
      try {
        const results = await searchTranscripts(db, trimmed, 50, get().searchFilters);
        if (get().searchQuery.trim() === trimmed) {
          set({
            searchResults: results,
            searchLoading: false,
            searchHistory: pushHistory(get().searchHistory, trimmed),
          });
        }
      } catch (e) {
        console.error('[archive] search failed', e);
        set({ searchLoading: false });
      }
    }, 300);
  },

  clearSearch: () => {
    if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }
    set({ searchQuery: '', searchResults: [], searchLoading: false, searchFilters: {} });
  },

  removeHistory: (query) => {
    set((s) => ({ searchHistory: s.searchHistory.filter((h) => h !== query) }));
  },

  setSearchFilters: (db, partial) => {
    set((s) => ({ searchFilters: { ...s.searchFilters, ...partial } }));
    // 활성 검색어가 있으면 갱신된 필터로 즉시 재검색.
    const q = get().searchQuery;
    if (q.trim()) get().setSearchQuery(db, q);
  },

  deleteEntry: async (db, entry, opts) => {
    await deleteEntryWithCleanup(db, entry, opts);
    set((s) => {
      // 캘린더 dot 즉시 감소: 근사 날짜(boundary hour 무시)로 매핑
      // 탭 포커스 시 loadMonth로 정확히 갱신되므로 허용 가능한 근사
      const approxDate = format(new Date(entry.recordedAt), 'yyyy-MM-dd');
      const updated = { ...s.entriesByDate };
      if (approxDate in updated) {
        updated[approxDate] = Math.max(0, updated[approxDate] - 1);
      }
      return {
        selectedEntries: s.selectedEntries.filter((i) => i.entry.id !== entry.id),
        searchResults: s.searchResults.filter((i) => i.entry.id !== entry.id),
        timelineItems: s.timelineItems.filter((i) => i.entry.id !== entry.id),
        onThisDay: s.onThisDay.filter((e) => e.id !== entry.id),
        entriesByDate: updated,
      };
    });
  },

  loadTimeline: async (db) => {
    set({ timelineLoading: true, timelineItems: [], timelineHasMore: true });
    try {
      const entries = await getEntriesPage(db, Number.MAX_SAFE_INTEGER, TIMELINE_PAGE);
      const items = await hydrate(db, entries);
      set({ timelineItems: items, timelineHasMore: entries.length === TIMELINE_PAGE });
    } catch (e) {
      console.error('[archive] loadTimeline failed', e);
    } finally {
      set({ timelineLoading: false });
    }
  },

  loadMoreTimeline: async (db) => {
    const { timelineItems, timelineLoading, timelineHasMore } = get();
    if (timelineLoading || !timelineHasMore || timelineItems.length === 0) return;
    const last = timelineItems[timelineItems.length - 1];
    set({ timelineLoading: true });
    try {
      const entries = await getEntriesPage(db, last.entry.recordedAt, TIMELINE_PAGE);
      const items = await hydrate(db, entries);
      set((s) => ({
        timelineItems: [...s.timelineItems, ...items],
        timelineHasMore: entries.length === TIMELINE_PAGE,
      }));
    } catch (e) {
      console.error('[archive] loadMoreTimeline failed', e);
    } finally {
      set({ timelineLoading: false });
    }
  },

  loadOnThisDay: async (db) => {
    try {
      const entries = await getOnThisDay(db, Date.now());
      set({ onThisDay: entries });
    } catch (e) {
      console.error('[archive] loadOnThisDay failed', e);
    }
  },
}));
