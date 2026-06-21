/** @codemap 아카이브 탭(/archive) — 캘린더 · 주간뷰 · 전문검색(FTS)
 *  데이터: 검색 db/repos/transcripts(searchTranscripts) · 상태 stores/archive, stores/today
 *  표현 컴포넌트: components/archive/CalendarParts · 관련 ADR: 010(FTS), 013
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
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { EntryCard } from '@/components/EntryCard';
import { MomentsRow } from '@/components/MomentsRow';
import { ArchiveSearchBar } from '@/components/archive/ArchiveSearchBar';
import { SearchFilterChips } from '@/components/archive/SearchFilterChips';
import { CalendarDay, WeekStrip } from '@/components/archive/CalendarParts';
import { ArchiveEmpty } from '@/components/archive/ArchiveEmpty';
import { OnThisDayStrip } from '@/components/archive/OnThisDayStrip';
import { TimelineDecisionItem } from '@/components/archive/TimelineDecisionItem';
import { TimelineMemoItem } from '@/components/archive/TimelineMemoItem';
import { TimelineSeparator, bucketFor, type TimelineLevel } from '@/components/archive/TimelineSeparator';
import { AppText, Button, Card, Highlight, Icon, ScreenBackground } from '@/components/ui';
import { updateUserEdit } from '@/db';
import type { TimelineDecision } from '@/db/repos/decisions';
import type { SearchResult } from '@/db/repos/transcripts';
import { useArchiveStore } from '@/stores/archive';
import type { EntryWithTranscript } from '@/stores/archive';
import type { EditParams } from '@/stores/inbox';
import { layoutAnimate } from '@/lib/motion';
import { haptics } from '@/lib/haptics';
import { useTodayStore } from '@/stores/today';
import type { Decision } from '@/types/domain';
import { colors, fontFamily, iconSize, layout, radius, shadow, spacing } from '@/theme';

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
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',
  textSectionTitleColor: colors.text.tertiary,
  selectedDayBackgroundColor: colors.brand.primary,
  selectedDayTextColor: colors.brand.onPrimary,
  todayTextColor: colors.brand.primary,
  todayBackgroundColor: 'transparent',
  dayTextColor: colors.text.primary,
  textDisabledColor: colors.border.dashed,
  dotColor: colors.brand.primary,
  selectedDotColor: colors.brand.onPrimary,
  arrowColor: colors.brand.primary,
  disabledArrowColor: colors.border.dashed,
  monthTextColor: colors.text.primary,
  textDayFontFamily: fontFamily.body,
  textMonthFontFamily: fontFamily.display,
  textDayHeaderFontFamily: fontFamily.body,
  textDayFontWeight: '500' as const,
  textMonthFontWeight: '700' as const,
  textDayHeaderFontWeight: '600' as const,
  textDayFontSize: 14,
  textMonthFontSize: 20,
  textDayHeaderFontSize: 12,
};

// 개월 이동 화살표 — 기본 화살표가 작아 터치가 어려워 44pt 버튼으로 교체(시인성·접근성)
function renderCalendarArrow(direction: 'left' | 'right') {
  return (
    <View style={styles.calArrow}>
      <Icon
        name={direction === 'left' ? 'back' : 'forward'}
        size={iconSize.md}
        color={colors.brand.primary}
      />
    </View>
  );
}

type ArchiveMode = 'month' | 'week';

// FlatList 아이템 타입 — 검색/캘린더 모드 통합
type CalItem = { _k: 'cal' } & EntryWithTranscript;
type SrchItem = { _k: 'srch' } & SearchResult;
type ListItem = CalItem | SrchItem;

// 타임라인 병합 행 — Entry와 결정 인레이를 한 시간축에.
type TimelineRow =
  | { kind: 'entry'; key: string; sortTs: number; item: EntryWithTranscript }
  | { kind: 'decision'; key: string; sortTs: number; td: TimelineDecision }
  | { kind: 'sep'; key: string; sortTs: number; level: TimelineLevel; label: string };

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
    if (store.selectedDate) await store.selectDate(db, store.selectedDate);
    await store.loadTimelineDecisions(db);
  }, [db, editingDecision, store]);

  // ── FlatList 데이터 ─────────────────────────────────────
  // 검색 모드만 세로 리스트(EntryCard). 캘린더 모드는 헤더의 MomentsRow가 표시.
  const listData: ListItem[] = useMemo(() => {
    if (isSearchMode) {
      return store.searchResults.map((r) => ({ _k: 'srch' as const, ...r }));
    }
    return [];
  }, [isSearchMode, store.searchResults]);

  const handleDelete = useCallback(
    (entry: Parameters<typeof store.deleteEntry>[1], opts: Parameters<typeof store.deleteEntry>[2]) => {
      store.deleteEntry(db, entry, opts);
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

  const keyExtractor = useCallback((item: ListItem) => item.entry.id, []);

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

  // 타임라인: Entry + 결정 인레이 병합. 결정은 아직 로드된 Entry 시간 범위까지만 노출
  // (더 오래된 Entry가 로드되면 그 시점의 결정도 함께 보이도록).
  const timelineRows: TimelineRow[] = useMemo(() => {
    const entryRows: TimelineRow[] = store.timelineItems.map((it) => ({
      kind: 'entry', key: `e:${it.entry.id}`, sortTs: it.entry.recordedAt, item: it,
    }));
    const cutoff = store.timelineHasMore && store.timelineItems.length > 0
      ? store.timelineItems[store.timelineItems.length - 1].entry.recordedAt
      : Number.NEGATIVE_INFINITY;
    const decisionRows: TimelineRow[] = store.timelineDecisions
      .filter((d) => d.sortTs >= cutoff)
      .map((d) => ({ kind: 'decision', key: `d:${d.decision.id}`, sortTs: d.sortTs, td: d }));
    const merged = [...entryRows, ...decisionRows].sort((a, b) => b.sortTs - a.sortTs);
    // 시간 단위(오늘/일/주/월/년) 구분선 삽입 — 버킷 키가 바뀌는 첫 항목 앞에.
    const now = new Date();
    const out: TimelineRow[] = [];
    let lastKey = '';
    for (const row of merged) {
      const b = bucketFor(row.sortTs, now);
      if (b.key !== lastKey) {
        out.push({ kind: 'sep', key: `sep:${b.key}`, sortTs: row.sortTs, level: b.level, label: b.label });
        lastKey = b.key;
      }
      out.push(row);
    }
    return out;
  }, [store.timelineItems, store.timelineDecisions, store.timelineHasMore]);

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
        <FlatList
          data={timelineRows}
          keyExtractor={(r) => r.key}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                haptics.tap();
                await Promise.all([store.loadTimeline(db), store.loadTimelineDecisions(db)]);
                setRefreshing(false);
              }}
              tintColor={colors.brand.primary}
              colors={[colors.brand.primary]}
            />
          }
          renderItem={({ item: row }) => {
            if (row.kind === 'sep') return <TimelineSeparator level={row.level} label={row.label} />;
            if (row.kind === 'decision') {
              return (
                <TimelineDecisionItem
                  decision={row.td.decision}
                  sortTs={row.td.sortTs}
                  onPress={() => setEditingDecision(row.td.decision)}
                />
              );
            }
            const it = row.item;
            // 메모(결정 없는 텍스트)는 썸네일 없이 인라인 수정.
            if (it.entry.mode === 'text' && !it.decision) {
              return (
                <TimelineMemoItem
                  entry={it.entry}
                  onSave={(text) => store.updateMemo(db, it.entry.id, text)}
                  onDelete={() => handleDelete(it.entry, { deleteFiles: false, deleteFromVault: false })}
                />
              );
            }
            return (
              <EntryCard
                entry={it.entry}
                transcript={it.transcript}
                decision={it.decision}
                showDate
                vaultConnected={store.vaultConnected}
                onPress={() => (it.entry.mode === 'text' && it.decision
                  ? setEditingDecision(it.decision)
                  : router.push(`/entry/${it.entry.id}`))}
                onDelete={(opts) => handleDelete(it.entry, opts)}
              />
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + spacing.lg }]}
          onEndReached={() => store.loadMoreTimeline(db)}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            store.timelineLoading ? null : (
              <ArchiveEmpty
                icon="archive"
                message="아직 남긴 기록이 없어요"
                ctaLabel="기록 남기기"
                onCta={goCapture}
              />
            )
          }
          ListFooterComponent={
            store.timelineLoading ? (
              <View style={styles.centeredRow}><ActivityIndicator color={colors.brand.primary} /></View>
            ) : null
          }
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
            <Card padding={spacing.sm} style={styles.calendarCard}>
              <Calendar
                key="full"
                current={`${store.currentMonth}-01`}
                monthFormat="yyyy년 M월"
                firstDay={0}
                onDayPress={handleDayPress}
                onMonthChange={handleMonthChange}
                maxDate={today}
                theme={CALENDAR_THEME}
                renderArrow={renderCalendarArrow}
                dayComponent={({ date }) => (
                  <CalendarDay
                    date={date}
                    entriesByDate={store.entriesByDate}
                    selectedDate={store.selectedDate}
                    today={today}
                    onPress={handleDayPress}
                  />
                )}
              />
            </Card>

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

  calendarCard: { marginBottom: spacing.md },
  calendarCardCompact: { marginBottom: spacing.sm },
  monthLoader: { paddingVertical: spacing.md, alignItems: 'center' },
  momentsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  momentsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  momentsExpanded: { flex: 1 },
  centeredRow: { paddingVertical: spacing['2xl'], alignItems: 'center' },

  calArrow: {
    width: layout.minTouch, height: layout.minTouch, borderRadius: radius.pill,
    backgroundColor: colors.surface.paperRaised, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.card,
    ...shadow.card,
  },

  // ── 공통 ────────────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: layout.screenPaddingX },
});

