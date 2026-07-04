/** @codemap 아카이브 탭(/archive) — 캘린더 · 주간뷰 · 타임라인 · 전문검색(FTS)
 *  데이터: 검색 db/repos/transcripts(searchTranscripts) · 상태 stores/archive, stores/today
 *  표현 컴포넌트: components/archive/{CalendarParts,ArchiveCalendarCard,ArchiveTimelineList}
 *  관련 ADR: 010(FTS), 013
 */
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { addDays, format, parseISO } from 'date-fns';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  ScrollView, StyleSheet, View,
} from 'react-native';
import type { DateData } from 'react-native-calendars';

import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { EntryCard } from '@/components/EntryCard';
import { MomentsRow } from '@/components/MomentsRow';
import { ArchiveSearchBar } from '@/components/archive/ArchiveSearchBar';
import { SearchFilterChips } from '@/components/archive/SearchFilterChips';
import { WeekStrip } from '@/components/archive/CalendarParts';
import { ArchiveCalendarCard } from '@/components/archive/ArchiveCalendarCard';
import { ArchiveTimelineList, buildTimelineRows } from '@/components/archive/ArchiveTimelineList';
import type { TimelineRow } from '@/components/archive/ArchiveTimelineList';
import { ArchiveEmpty } from '@/components/archive/ArchiveEmpty';
import { OnThisDayStrip } from '@/components/archive/OnThisDayStrip';
import { TimelineDecisionItem } from '@/components/archive/TimelineDecisionItem';
import { AppText, Button, Card, Highlight, ScreenBackground } from '@/components/ui';
import { updateUserEdit } from '@/db';
import { syncFollowUpForDecision } from '@/services/followUpNotifications';
import type { DecisionSearchResult } from '@/db/repos/decisions';
import type { SearchResult } from '@/db/repos/transcripts';
import { useArchiveStore } from '@/stores/archive';
import type { EntryWithTranscript } from '@/stores/archive';
import type { EditParams } from '@/stores/inbox';
import { layoutAnimate } from '@/lib/motion';
import { haptics } from '@/lib/haptics';
import { useTodayStore } from '@/stores/today';
import type { Decision } from '@/types/domain';
import { colors, layout, radius, spacing } from '@/theme';

type ArchiveMode = 'month' | 'week';

// FlatList 아이템 타입 — 검색/캘린더 모드 통합
type CalItem = { _k: 'cal' } & EntryWithTranscript;
type SrchItem = { _k: 'srch' } & SearchResult;
// 결정 검색 결과 인레이 — 엔트리와 같은 시간축 병합용 sortTs 포함(D1).
type DecSrchItem = { _k: 'dsrch'; sortTs: number } & DecisionSearchResult;
type ListItem = CalItem | SrchItem | DecSrchItem;

export default function ArchiveScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const store = useArchiveStore();
  const setTodayViewDate = useTodayStore((s) => s.setViewDate);
  const tabBarHeight = useBottomTabBarHeight();

  // 캘린더 표시 단위: month(달) | week(주). 명시적 세그먼트로 선택.
  const [mode, setMode] = useState<ArchiveMode>('month');
  const [refreshing, setRefreshing] = useState(false);
  // 열람 뷰: 캘린더(날짜 선택) | 타임라인(역시간순 연속 피드)
  const [view, setView] = useState<'calendar' | 'timeline'>('calendar');
  const [weekAnchor, setWeekAnchor] = useState<string | null>(null);
  // 검색 포커스 (히스토리 표시 트리거)
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 의사결정 수정 시트 대상 (Archive에서 의사결정 탭 시)
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);

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

  const today = format(new Date(), 'yyyy-MM-dd');

  // 오늘 날짜 선택으로 이동(기본 동작 / 탭 재진입)
  const goToToday = useCallback(() => {
    const tMonth = format(new Date(), 'yyyy-MM');
    if (store.currentMonth !== tMonth) store.loadMonth(db, tMonth);
    layoutAnimate();
    setView('calendar');
    setMode('month');
    store.selectDate(db, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, today, store.currentMonth]);

  // 캘린더 표시 단위 전환(명시적 세그먼트).
  const selectMonth = useCallback(() => {
    layoutAnimate();
    setView('calendar');
    setMode('month');
  }, []);
  const selectWeek = useCallback(() => {
    layoutAnimate();
    setView('calendar');
    setMode('week');
    setWeekAnchor(store.selectedDate ?? today);
  }, [store.selectedDate, today]);

  const shiftWeek = useCallback((deltaDays: number) => {
    setWeekAnchor((prev) => {
      const base = prev ?? store.selectedDate ?? today;
      const next = format(addDays(parseISO(base), deltaDays), 'yyyy-MM-dd');
      const nextMonth = next.slice(0, 7);
      if (nextMonth !== store.currentMonth) store.loadMonth(db, nextMonth);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, store.selectedDate, store.currentMonth, today]);

  // ── 캘린더 ──────────────────────────────────────────────────────────────────
  const didInitRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      store.loadMonth(db, store.currentMonth);
      store.loadOnThisDay(db);
      // 첫 진입 시 오늘 날짜를 기본 선택
      if (!didInitRef.current) {
        didInitRef.current = true;
        store.selectDate(db, today);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]),
  );

  // Archive 탭을 누르면 오늘 날짜 선택
  useEffect(() => {
    const nav = navigation as unknown as {
      addListener: (event: 'tabPress', cb: () => void) => () => void;
    };
    return nav.addListener('tabPress', () => setTimeout(goToToday, 50));
  }, [navigation, goToToday]);

  const monthTotal = useMemo(
    () => Object.values(store.entriesByDate).reduce((a, c) => a + c, 0),
    [store.entriesByDate],
  );

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

  // 빈 상태 CTA — 캡처가 있는 Today로 이동.
  const goCapture = useCallback(() => router.navigate('/(tabs)/today'), []);

  // 캘린더 ↔ 타임라인 전환. 타임라인 첫 진입 시 1페이지 로드.
  const handleSelectView = useCallback((v: 'calendar' | 'timeline') => {
    setView(v);
    if (v === 'timeline' && store.timelineItems.length === 0) store.loadTimeline(db);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, store.timelineItems.length]);

  // 모먼트 탭: 의사결정(확정/수정) 텍스트면 결정 수정 시트, 그 외는 상세로.
  const handleMomentPress = useCallback((item: EntryWithTranscript) => {
    if (item.entry.mode === 'text' && item.decision) {
      setEditingDecision(item.decision);
    } else {
      router.push(`/entry/${item.entry.id}`);
    }
  }, []);

  // 결정 수정 저장 — decisions.tsx와 동일 경로(updateUserEdit) 후 선택 날짜 재로드.
  const handleEditDecisionSave = useCallback(async (edits: EditParams) => {
    const target = editingDecision;
    setEditingDecision(null);
    if (!target) return;
    await updateUserEdit(db, target.id, {
      ...edits,
      followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
    });
    await syncFollowUpForDecision(db, target.id);
    if (store.selectedDate) await store.selectDate(db, store.selectedDate);
    await store.loadTimelineDecisions(db);
  }, [db, editingDecision, store]);

  // ── FlatList 데이터 ─────────────────────────────────────
  // 검색 모드만 세로 리스트(EntryCard). 캘린더 모드는 헤더의 MomentsRow가 표시.
  const listData: ListItem[] = useMemo(() => {
    if (!isSearchMode) return [];
    // 텍스트 엔트리가 곧 의사결정이면 결정 카드와 중복되므로 엔트리(메모) 결과를 제외(타임라인 e.mode!='text'와 동일 취지).
    const decisionEntryIds = new Set(store.searchDecisionResults.map((r) => r.decision.entryId));
    const entryItems: ListItem[] = store.searchResults
      .filter((r) => !(r.entry.mode === 'text' && decisionEntryIds.has(r.entry.id)))
      .map((r) => ({ _k: 'srch' as const, ...r }));
    const decisionItems: ListItem[] = store.searchDecisionResults.map((r) => ({
      _k: 'dsrch' as const,
      // 진행 시각(실행>확정>추출) 기준 — 엔트리 recordedAt과 같은 시간축으로 정렬.
      sortTs: r.decision.executedAt ?? r.decision.confirmedAt ?? r.decision.extractedAt,
      ...r,
    }));
    const tsOf = (it: ListItem) => (it._k === 'dsrch' ? it.sortTs : it.entry.recordedAt);
    return [...entryItems, ...decisionItems].sort((x, y) => tsOf(y) - tsOf(x));
  }, [isSearchMode, store.searchResults, store.searchDecisionResults]);

  const handleDelete = useCallback(
    (entry: Parameters<typeof store.deleteEntry>[1], opts: Parameters<typeof store.deleteEntry>[2]) => {
      store.deleteEntry(db, entry, opts);
    },
    [db, store],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item._k === 'dsrch') {
        return (
          <TimelineDecisionItem
            decision={item.decision}
            sortTs={item.sortTs}
            onPress={() => setEditingDecision(item.decision)}
          />
        );
      }
      if (item._k === 'srch') {
        return (
          <EntryCard
            entry={item.entry}
            transcript={null}
            snippet={item.snippet}
            showDate
            vaultConnected={store.vaultConnected}
            onPress={() => router.push(`/entry/${item.entry.id}`)}
            onDelete={(opts) => handleDelete(item.entry, opts)}
          />
        );
      }
      return (
        <EntryCard
          entry={item.entry}
          transcript={item.transcript}
          vaultConnected={store.vaultConnected}
          onPress={() => router.push(`/entry/${item.entry.id}`)}
          onDelete={(opts) => handleDelete(item.entry, opts)}
        />
      );
    },
    [handleDelete],
  );

  const keyExtractor = useCallback(
    (item: ListItem) => (item._k === 'dsrch' ? `d:${item.decision.id}` : item.entry.id),
    [],
  );

  // ── 빈 상태 메시지 ────────────────────────────────────────────────────────────
  const hasEntriesInMonth = monthTotal > 0;

  const EmptyComponent = useMemo(() => {
    if (isSearchMode) {
      if (store.searchLoading) return null;
      return (
        <ArchiveEmpty
          icon="search"
          message={`'${store.searchQuery.trim()}'에 대한 기록이 없어요`}
        />
      );
    }
    if (store.loading || store.selectedLoading) return null;
    const msg = store.selectedDate
      ? (store.selectedEntries.length > 0 ? null : '해당 날짜에 기록이 없어요')
      : !hasEntriesInMonth
        ? '이번 달엔 아직 기록이 없어요'
        : null;
    if (!msg) return null;
    return <ArchiveEmpty icon="calendar" message={msg} />;
  }, [isSearchMode, store.searchLoading, store.searchQuery, store.loading,
      store.selectedLoading, store.selectedDate, store.selectedEntries.length, hasEntriesInMonth]);

  // ── 헤더 컴포넌트 ─────────────────────────────────────────────────────────────
  const selectedDateLabel = store.selectedDate
    ? format(parseISO(store.selectedDate), 'M월 d일')
    : null;

  const momentsHeader = store.selectedDate ? (
    <View style={styles.momentsHeader}>
      <View style={styles.momentsHeaderLeft}>
        <AppText preset="titleMedium">{selectedDateLabel}</AppText>
        {store.selectedEntries.length > 0 && (
          <AppText preset="caption" color={colors.text.secondary}>{`${store.selectedEntries.length} MOMENTS`}</AppText>
        )}
      </View>
      <Button label="일기로 보기" variant="quiet" size="sm" onPress={handleGoToToday} />
    </View>
  ) : null;

  // 세그먼트 활성 상태(월/주/타임라인)
  const isMonth = view === 'calendar' && mode === 'month';
  const isWeek = view === 'calendar' && mode === 'week';
  const isTimeline = view === 'timeline';

  // 타임라인 병합 행 — 로직은 ArchiveTimelineList의 buildTimelineRows(순수 함수)에.
  const timelineRows: TimelineRow[] = useMemo(
    () => buildTimelineRows(store.timelineItems, store.timelineDecisions, store.timelineHasMore),
    [store.timelineItems, store.timelineDecisions, store.timelineHasMore],
  );

  return (
    <ScreenBackground edges={['top']}>
      {/* 고정 상단: 타이틀 + 검색 */}
      <View style={styles.topBlock}>
        <View style={styles.titleRow}>
          <Highlight vary="archive-title">
            <AppText preset="displayCompact">Archive</AppText>
          </Highlight>
          <View style={styles.titleRight}>
            {!isSearchMode && hasEntriesInMonth && (
              <AppText preset="caption" color={colors.text.secondary}>{`이번 달 ${monthTotal}개`}</AppText>
            )}
          </View>
        </View>

        <ArchiveSearchBar
          searchQuery={store.searchQuery}
          searchFocused={searchFocused}
          showHistory={showHistory}
          searchHistory={store.searchHistory}
          isSearchMode={isSearchMode}
          searchLoading={store.searchLoading}
          searchResultCount={store.searchResults.length}
          onChangeQuery={(q) => store.setSearchQuery(db, q)}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          onClear={store.clearSearch}
          onPickHistory={(q) => store.setSearchQuery(db, q)}
          onRemoveHistory={store.removeHistory}
        />

        {isSearchMode && (
          <SearchFilterChips
            filters={store.searchFilters}
            onChange={(p) => store.setSearchFilters(db, p)}
            includeDecisions={store.searchIncludeDecisions}
            onToggleDecisions={() => store.toggleIncludeDecisions(db)}
          />
        )}

        {!isSearchMode && (
          <View style={styles.viewSeg}>
            <Pressable style={[styles.segBtn, isMonth && styles.segBtnActive]} onPress={selectMonth}>
              <AppText preset="caption" color={isMonth ? colors.brand.onPrimary : colors.text.secondary}>월</AppText>
            </Pressable>
            <Pressable style={[styles.segBtn, isWeek && styles.segBtnActive]} onPress={selectWeek}>
              <AppText preset="caption" color={isWeek ? colors.brand.onPrimary : colors.text.secondary}>주</AppText>
            </Pressable>
            <Pressable style={[styles.segBtn, isTimeline && styles.segBtnActive]} onPress={() => handleSelectView('timeline')}>
              <AppText preset="caption" color={isTimeline ? colors.brand.onPrimary : colors.text.secondary}>타임라인</AppText>
            </Pressable>
          </View>
        )}
      </View>

      {isSearchMode ? (
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={EmptyComponent}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      ) : view === 'timeline' ? (
        <ArchiveTimelineList
          rows={timelineRows}
          loading={store.timelineLoading}
          refreshing={refreshing}
          vaultConnected={store.vaultConnected}
          bottomInset={tabBarHeight}
          onRefresh={async () => {
            setRefreshing(true);
            haptics.tap();
            await Promise.all([store.loadTimeline(db), store.loadTimelineDecisions(db)]);
            setRefreshing(false);
          }}
          onEndReached={() => store.loadMoreTimeline(db)}
          onEditDecision={setEditingDecision}
          onSaveMemo={(entryId, text) => store.updateMemo(db, entryId, text)}
          onDeleteEntry={handleDelete}
          onPressEntry={(entryId) => router.push(`/entry/${entryId}`)}
          onCta={goCapture}
        />
      ) : mode === 'month' ? (
        <View style={styles.calendarMode}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.lg }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  haptics.tap();
                  await store.loadMonth(db, store.currentMonth);
                  setRefreshing(false);
                }}
                tintColor={colors.brand.primary}
                colors={[colors.brand.primary]}
              />
            }
          >
            <OnThisDayStrip items={store.onThisDay} onPress={(e) => router.push(`/entry/${e.id}`)} />
            <ArchiveCalendarCard
              currentMonth={store.currentMonth}
              today={today}
              entriesByDate={store.entriesByDate}
              selectedDate={store.selectedDate}
              onDayPress={handleDayPress}
              onMonthChange={handleMonthChange}
            />

            {store.loading && (
              <View style={styles.monthLoader}><ActivityIndicator size="small" color={colors.brand.primary} /></View>
            )}

            {momentsHeader}

            {store.selectedDate && !store.selectedLoading && (
              store.selectedEntries.length > 0 ? (
                <MomentsRow
                  items={store.selectedEntries}
                  onPressItem={handleMomentPress}
                  mode="strip"
                />
              ) : (
                <ArchiveEmpty icon="calendar" message="해당 날짜에 기록이 없어요" />
              )
            )}
            {store.selectedLoading && (
              <View style={styles.centeredRow}><ActivityIndicator color={colors.brand.primary} /></View>
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.calendarMode}>
          <Card padding={spacing.xs} style={styles.calendarCardCompact}>
            <WeekStrip
              anchor={weekAnchor ?? store.selectedDate ?? today}
              entriesByDate={store.entriesByDate}
              selectedDate={store.selectedDate}
              today={today}
              onPressDay={handleDayPress}
              onShiftWeek={shiftWeek}
            />
          </Card>

          {momentsHeader}

          {store.selectedDate && !store.selectedLoading && (
            store.selectedEntries.length > 0 ? (
              <View style={styles.momentsExpanded}>
                <MomentsRow
                  items={store.selectedEntries}
                  onPressItem={handleMomentPress}
                  mode="grid"
                  bottomInset={tabBarHeight}
                />
              </View>
            ) : (
              <ArchiveEmpty icon="calendar" message="해당 날짜에 기록이 없어요" />
            )
          )}
          {store.selectedLoading && (
            <View style={styles.centeredRow}><ActivityIndicator color={colors.brand.primary} /></View>
          )}
        </View>
      )}

      {editingDecision && (
        <EditDecisionSheet
          key={editingDecision.id}
          visible
          decision={editingDecision}
          onCancel={() => setEditingDecision(null)}
          onSave={handleEditDecisionSave}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  topBlock: { paddingHorizontal: layout.screenPaddingX },
  calendarMode: { flex: 1, paddingHorizontal: layout.screenPaddingX },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm,
  },
  titleRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  viewSeg: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  segBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
    backgroundColor: colors.surface.sunken,
  },
  segBtnActive: { backgroundColor: colors.brand.primary },

  calendarCardCompact: { marginBottom: spacing.sm, borderRadius: radius.xs },
  monthLoader: { paddingVertical: spacing.md, alignItems: 'center' },
  momentsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  momentsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  momentsExpanded: { flex: 1 },
  centeredRow: { paddingVertical: spacing['2xl'], alignItems: 'center' },

  // ── 공통 ────────────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: layout.screenPaddingX },
});

