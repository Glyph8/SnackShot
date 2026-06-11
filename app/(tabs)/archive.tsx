import { format, parseISO } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useTodayStore } from '@/stores/today';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

import { EntryCard } from '@/components/EntryCard';
import type { SearchResult } from '@/db/repos/transcripts';
import { useArchiveStore } from '@/stores/archive';
import type { EntryWithTranscript } from '@/stores/archive';

// ─── 한국어 로케일 (모듈 레벨, 1회) ──────────────────────────────────────────
LocaleConfig.locales['ko'] = {
  monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  monthNamesShort: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  dayNames: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
  dayNamesShort: ['일','월','화','수','목','금','토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

const CALENDAR_THEME = {
  backgroundColor: '#fff',
  calendarBackground: '#fff',
  textSectionTitleColor: '#aaa',
  selectedDayBackgroundColor: '#111',
  selectedDayTextColor: '#fff',
  todayTextColor: '#111',
  todayBackgroundColor: 'transparent',
  dayTextColor: '#222',
  textDisabledColor: '#ddd',
  dotColor: '#111',
  selectedDotColor: '#fff',
  arrowColor: '#111',
  disabledArrowColor: '#ddd',
  monthTextColor: '#111',
  textDayFontWeight: '500' as const,
  textMonthFontWeight: '700' as const,
  textDayHeaderFontWeight: '600' as const,
  textDayFontSize: 14,
  textMonthFontSize: 17,
  textDayHeaderFontSize: 12,
};

// FlatList 아이템 타입 — 검색/캘린더 모드 통합
type CalItem = { _k: 'cal' } & EntryWithTranscript;
type SrchItem = { _k: 'srch' } & SearchResult;
type ListItem = CalItem | SrchItem;

export default function ArchiveScreen() {
  const db = useSQLiteContext();
  const store = useArchiveStore();
  const setTodayViewDate = useTodayStore((s) => s.setViewDate);

  // 검색 포커스 (히스토리 표시 트리거)
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setSearchFocused(true);
  }, []);
  // onBlur에 짧은 딜레이 — 히스토리 탭이 onBlur보다 먼저 처리되도록
  const handleSearchBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
  }, []);

  const isSearchMode = store.searchQuery.trim().length > 0;
  const showHistory =
    searchFocused && !isSearchMode && store.searchHistory.length > 0;

  // ── 캘린더 ──────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      store.loadMonth(db, store.currentMonth);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]),
  );

  const today = format(new Date(), 'yyyy-MM-dd');

  const markedDates = useMemo(() => {
    const marks: Record<string, object> = {};
    for (const [date, count] of Object.entries(store.entriesByDate)) {
      if (count > 0) marks[date] = { marked: true, dotColor: '#555' };
    }
    if (store.selectedDate) {
      marks[store.selectedDate] = {
        ...(typeof marks[store.selectedDate] === 'object' ? marks[store.selectedDate] : {}),
        selected: true, selectedColor: '#111', dotColor: '#fff',
      };
    }
    return marks;
  }, [store.entriesByDate, store.selectedDate]);

  const handleDayPress = useCallback(
    (day: DateData) => {
      if (day.dateString > today) return;
      store.selectDate(db, day.dateString === store.selectedDate ? null : day.dateString);
    },
    [db, today, store],
  );

  const handleMonthChange = useCallback(
    (month: DateData) => {
      store.loadMonth(db, `${month.year}-${String(month.month).padStart(2, '0')}`);
    },
    [db, store],
  );

  const handleGoToToday = useCallback(() => {
    if (!store.selectedDate) return;
    setTodayViewDate(store.selectedDate);
    router.navigate('/(tabs)/today');
  }, [store.selectedDate, setTodayViewDate]);

  // ── FlatList 데이터 (단일 타입으로 통합) ─────────────────────────────────────
  const listData: ListItem[] = useMemo(() => {
    if (isSearchMode) {
      return store.searchResults.map((r) => ({ _k: 'srch' as const, ...r }));
    }
    return store.selectedEntries.map((e) => ({ _k: 'cal' as const, ...e }));
  }, [isSearchMode, store.searchResults, store.selectedEntries]);

  const handleDelete = useCallback(
    (entry: Parameters<typeof store.deleteEntry>[1], deleteFiles: boolean) => {
      store.deleteEntry(db, entry, deleteFiles);
    },
    [db, store],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item._k === 'srch') {
        return (
          <EntryCard
            entry={item.entry}
            transcript={null}
            snippet={item.snippet}
            showDate
            onPress={() => router.push(`/entry/${item.entry.id}`)}
            onDelete={(del) => handleDelete(item.entry, del)}
          />
        );
      }
      return (
        <EntryCard
          entry={item.entry}
          transcript={item.transcript}
          onPress={() => router.push(`/entry/${item.entry.id}`)}
          onDelete={(del) => handleDelete(item.entry, del)}
        />
      );
    },
    [handleDelete],
  );

  const keyExtractor = useCallback((item: ListItem) => item.entry.id, []);

  // ── 빈 상태 메시지 ────────────────────────────────────────────────────────────
  const hasEntriesInMonth = Object.values(store.entriesByDate).some((c) => c > 0);

  const EmptyComponent = useMemo(() => {
    if (isSearchMode) {
      if (store.searchLoading) return null;
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>
            '{store.searchQuery.trim()}'에 대한 기록이 없어요
          </Text>
        </View>
      );
    }
    if (store.loading || store.selectedLoading) return null;
    const msg = store.selectedDate
      ? '해당 날짜에 기록이 없어요'
      : !hasEntriesInMonth
        ? '이번 달엔 아직 기록이 없어요'
        : null;
    if (!msg) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTxt}>{msg}</Text>
      </View>
    );
  }, [isSearchMode, store.searchLoading, store.searchQuery, store.loading,
      store.selectedLoading, store.selectedDate, hasEntriesInMonth]);

  // ── 헤더 컴포넌트 ─────────────────────────────────────────────────────────────
  const selectedDateLabel = store.selectedDate
    ? format(parseISO(store.selectedDate), 'M월 d일')
    : null;

  const ListHeader = useMemo(() => (
    <>
      {/* 타이틀 */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Archive</Text>
      </View>

      {/* 검색바 */}
      <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
        <Text style={styles.searchIcon}>⊙</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="전문 검색…"
          placeholderTextColor="#aaa"
          value={store.searchQuery}
          onChangeText={(q) => store.setSearchQuery(db, q)}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {store.searchQuery.length > 0 && (
          <Pressable onPress={store.clearSearch} hitSlop={8}>
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* 검색 히스토리 (포커스 + 쿼리 없음) */}
      {showHistory && (
        <View style={styles.historySection}>
          <Text style={styles.historyLabel}>최근 검색</Text>
          {store.searchHistory.map((q) => (
            <View key={q} style={styles.historyRow}>
              <Pressable
                style={styles.historyItemPressable}
                onPress={() => store.setSearchQuery(db, q)}
              >
                <Text style={styles.historyIcon}>↩</Text>
                <Text style={styles.historyText} numberOfLines={1}>{q}</Text>
              </Pressable>
              <Pressable
                onPress={() => store.removeHistory(q)}
                hitSlop={8}
                style={styles.historyRemove}
              >
                <Text style={styles.historyRemoveTxt}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* 검색 모드: 결과 카운트 / 로딩 */}
      {isSearchMode && (
        <View style={styles.searchStatus}>
          {store.searchLoading ? (
            <ActivityIndicator size="small" color="#bbb" />
          ) : (
            <Text style={styles.searchCount}>
              {store.searchResults.length > 0
                ? `${store.searchResults.length}개 결과`
                : null}
            </Text>
          )}
        </View>
      )}

      {/* 캘린더 모드 */}
      {!isSearchMode && (
        <>
          <Calendar
            current={`${store.currentMonth}-01`}
            monthFormat="yyyy년 M월"
            firstDay={0}
            onDayPress={handleDayPress}
            onMonthChange={handleMonthChange}
            markedDates={markedDates}
            maxDate={today}
            theme={CALENDAR_THEME}
            style={styles.calendar}
          />

          {store.loading && (
            <View style={styles.monthLoader}>
              <ActivityIndicator size="small" color="#bbb" />
            </View>
          )}

          {store.selectedDate && !store.selectedLoading && (
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderTxt}>{selectedDateLabel}</Text>
              <View style={styles.dateHeaderRight}>
                <Text style={styles.dateCount}>{store.selectedEntries.length}개</Text>
                <Pressable onPress={handleGoToToday} hitSlop={8} style={styles.goTodayBtn}>
                  <Text style={styles.goTodayTxt}>일기로 보기</Text>
                </Pressable>
              </View>
            </View>
          )}

          {store.selectedLoading && (
            <View style={styles.centeredRow}>
              <ActivityIndicator color="#aaa" />
            </View>
          )}
        </>
      )}
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [
    searchFocused, store.searchQuery, store.searchLoading, store.searchResults.length,
    store.searchHistory, showHistory, isSearchMode,
    store.currentMonth, markedDates, today, store.loading, store.selectedDate,
    store.selectedLoading, store.selectedEntries.length, selectedDateLabel,
    handleDayPress, handleMonthChange, handleSearchFocus, handleSearchBlur,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyComponent}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  titleRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  title: { fontSize: 22, fontWeight: '500' },

  // ── 검색바 ──────────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 6,
    backgroundColor: '#f2f2f2', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  searchBarFocused: { borderColor: '#d0d0d0', backgroundColor: '#fafafa' },
  searchIcon: { fontSize: 14, color: '#aaa' },
  searchInput: { flex: 1, fontSize: 15, color: '#111', padding: 0 },
  clearBtn: { fontSize: 13, color: '#bbb', paddingHorizontal: 2 },

  // ── 히스토리 ────────────────────────────────────────────────────────────────
  historySection: {
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ebebeb',
  },
  historyLabel: { fontSize: 11, color: '#bbb', fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f2f2f2',
  },
  historyItemPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { fontSize: 13, color: '#ccc' },
  historyText: { fontSize: 14, color: '#555', flex: 1 },
  historyRemove: { paddingLeft: 12 },
  historyRemoveTxt: { fontSize: 12, color: '#ccc' },

  // ── 검색 결과 헤더 ─────────────────────────────────────────────────────────
  searchStatus: {
    paddingHorizontal: 20, paddingVertical: 8, minHeight: 36, justifyContent: 'center',
  },
  searchCount: { fontSize: 13, color: '#999' },

  // ── 캘린더 ──────────────────────────────────────────────────────────────────
  calendar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ebebeb',
  },
  monthLoader: { paddingVertical: 12, alignItems: 'center' },
  dateHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  dateHeaderTxt: { fontSize: 15, fontWeight: '700', color: '#111' },
  dateHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateCount: { fontSize: 13, color: '#888' },
  goTodayBtn: {},
  goTodayTxt: { fontSize: 13, color: '#555', fontWeight: '500' },
  centeredRow: { paddingVertical: 24, alignItems: 'center' },

  // ── 공통 ────────────────────────────────────────────────────────────────────
  empty: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center' },
  emptyTxt: { fontSize: 14, color: '#bbb', textAlign: 'center', lineHeight: 20 },
  listContent: { paddingBottom: 40 },
});
