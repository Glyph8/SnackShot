import { addHours, addMonths, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import {
  countEntriesByMonth,
  getEntriesByDay,
  getLatestTranscript,
  getSettings,
  searchTranscripts,
  softDeleteEntry,
} from '@/db';
import type { SearchResult } from '@/db/repos/transcripts';
import { deleteEntryFiles } from '@/lib/storage';
import { getDayBoundary } from '@/lib/time';
import type { Entry, Transcript } from '@/types/domain';

export interface EntryWithTranscript {
  entry: Entry;
  transcript: Transcript | null;
}

interface ArchiveState {
  // ── 캘린더 ─────────────────────────────────────────────────────────────────
  currentMonth: string;
  entriesByDate: Record<string, number>;
  selectedDate: string | null;
  selectedEntries: EntryWithTranscript[];
  loading: boolean;
  selectedLoading: boolean;

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
  deleteEntry: (db: SQLiteDatabase, entry: Entry, deleteFiles: boolean) => Promise<void>;
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

  loadMonth: async (db, yearMonth) => {
    if (get().loading) return;
    set({ loading: true, currentMonth: yearMonth, selectedDate: null, selectedEntries: [] });
    try {
      const { dayBoundaryHour } = await getSettings(db);
      const [year, month] = yearMonth.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const startMs = addHours(startOfMonth(monthDate), dayBoundaryHour).getTime();
      const endMs = addHours(addMonths(startOfMonth(monthDate), 1), dayBoundaryHour).getTime();
      const counts = await countEntriesByMonth(db, startMs, endMs, dayBoundaryHour);
      set({ entriesByDate: counts });
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
        const results = await searchTranscripts(db, trimmed, 50);
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
    set({ searchQuery: '', searchResults: [], searchLoading: false });
  },

  removeHistory: (query) => {
    set((s) => ({ searchHistory: s.searchHistory.filter((h) => h !== query) }));
  },

  deleteEntry: async (db, entry, deleteFiles) => {
    await softDeleteEntry(db, entry.id);
    if (deleteFiles) deleteEntryFiles(entry);
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
        entriesByDate: updated,
      };
    });
  },
}));
