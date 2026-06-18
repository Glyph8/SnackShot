/** @codemap 아카이브 탭(/archive) — 캘린더 · 주간뷰 · 전문검색(FTS)
 *  데이터: 검색 db/repos/transcripts(searchTranscripts) · 상태 stores/archive, stores/today
 *  표현 컴포넌트: components/archive/CalendarParts · 관련 ADR: 010(FTS), 013
 */
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { addDays, format, parseISO } from 'date-fns';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, LayoutAnimation, Platform, Pressable,
  ScrollView, StyleSheet, UIManager, View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

import { EntryCard } from '@/components/EntryCard';
import { MomentsRow } from '@/components/MomentsRow';
import { ArchiveSearchBar } from '@/components/archive/ArchiveSearchBar';
import { CalendarDay, WeekStrip } from '@/components/archive/CalendarParts';
import { AppText, Button, Card, ScreenBackground } from '@/components/ui';
import type { SearchResult } from '@/db/repos/transcripts';
import { useArchiveStore } from '@/stores/archive';
import type { EntryWithTranscript } from '@/stores/archive';
import { useTodayStore } from '@/stores/today';
import { colors, fontFamily, iconSize, layout, spacing } from '@/theme';

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

// 확대 시 압축 캘린더 테마 — 폰트/여백 축소
const CALENDAR_THEME_COMPACT = {
  ...CALENDAR_THEME,
  textMonthFontSize: 16,
  textDayFontSize: 12,
  textDayHeaderFontSize: 11,
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
/** Moments 영역 전환 시 빠른 레이아웃 애니메이션 */
function animateNext() {
  LayoutAnimation.configureNext({ duration: 180, update: { type: 'easeInEaseOut' } });
}

type ArchiveMode = 'month' | 'compact' | 'week';

// FlatList 아이템 타입 — 검색/캘린더 모드 통합
type CalItem = { _k: 'cal' } & EntryWithTranscript;
type SrchItem = { _k: 'srch' } & SearchResult;
type ListItem = CalItem | SrchItem;

export default function ArchiveScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const store = useArchiveStore();
  const setTodayViewDate = useTodayStore((s) => s.setViewDate);
  const tabBarHeight = useBottomTabBarHeight();

  // Moments 영역 모드: month(전체 달) → compact(압축 달) → week(주 단위)
  const [mode, setMode] = useState<ArchiveMode>('month');
  const [weekAnchor, setWeekAnchor] = useState<string | null>(null);
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

  const today = format(new Date(), 'yyyy-MM-dd');

  // 오늘 날짜 선택으로 이동(기본 동작 / 탭 재진입)
  const goToToday = useCallback(() => {
    const tMonth = format(new Date(), 'yyyy-MM');
    if (store.currentMonth !== tMonth) store.loadMonth(db, tMonth);
    animateNext();
    setMode('month');
    store.selectDate(db, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, today, store.currentMonth]);

  // 헤더 탭 → 모드 순환 (month → compact → week → month)
  const cycleMode = useCallback(() => {
    animateNext();
    setMode((m) => {
      if (m === 'month') return 'compact';
      if (m === 'compact') {
        setWeekAnchor(store.selectedDate ?? today);
        return 'week';
      }
      return 'month';
    });
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
        <View style={styles.empty}>
          <AppText preset="bodyMedium" color={colors.text.tertiary}>
            '{store.searchQuery.trim()}'에 대한 기록이 없어요
          </AppText>
        </View>
      );
    }
    if (store.loading || store.selectedLoading) return null;
    const msg = store.selectedDate
      ? (store.selectedEntries.length > 0 ? null : '해당 날짜에 기록이 없어요')
      : !hasEntriesInMonth
        ? '이번 달엔 아직 기록이 없어요'
        : null;
    if (!msg) return null;
    return (
      <View style={styles.empty}>
        <AppText preset="bodyMedium" color={colors.text.tertiary}>{msg}</AppText>
      </View>
    );
  }, [isSearchMode, store.searchLoading, store.searchQuery, store.loading,
      store.selectedLoading, store.selectedDate, store.selectedEntries.length, hasEntriesInMonth]);

  // ── 헤더 컴포넌트 ─────────────────────────────────────────────────────────────
  const selectedDateLabel = store.selectedDate
    ? format(parseISO(store.selectedDate), 'M월 d일')
    : null;

  const momentsHeader = store.selectedDate ? (
    <View style={styles.momentsHeader}>
      <Pressable style={styles.momentsHeaderLeft} onPress={cycleMode} hitSlop={spacing.sm}>
        <AppText preset="titleMedium">{selectedDateLabel}</AppText>
        {store.selectedEntries.length > 0 && (
          <AppText preset="caption" color={colors.text.secondary}>{`${store.selectedEntries.length} MOMENTS`}</AppText>
        )}
        <Ionicons
          name={mode === 'week' ? 'chevron-down-circle' : 'chevron-up'}
          size={iconSize.md}
          color={colors.text.tertiary}
        />
      </Pressable>
      <Button label="일기로 보기" variant="quiet" size="sm" onPress={handleGoToToday} />
    </View>
  ) : null;

  return (
    <ScreenBackground edges={['top']}>
      {/* 고정 상단: 타이틀 + 검색 */}
      <View style={styles.topBlock}>
        <View style={styles.titleRow}>
          <AppText preset="displayLarge">Archive</AppText>
          <View style={styles.titleRight}>
            {!isSearchMode && hasEntriesInMonth && (
              <AppText preset="caption" color={colors.text.secondary}>{`이번 달 ${monthTotal}개`}</AppText>
            )}
            <Button label="의사결정 ▸" variant="secondary" size="sm" onPress={() => router.push('/decisions')} />
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
      ) : mode === 'month' ? (
        <View style={styles.calendarMode}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.lg }}>
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
                  onPressItem={(entryId) => router.push(`/entry/${entryId}`)}
                  mode="strip"
                />
              ) : (
                <View style={styles.empty}>
                  <AppText preset="bodyMedium" color={colors.text.tertiary}>해당 날짜에 기록이 없어요</AppText>
                </View>
              )
            )}
            {store.selectedLoading && (
              <View style={styles.centeredRow}><ActivityIndicator color={colors.brand.primary} /></View>
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.calendarMode}>
          {mode === 'compact' ? (
            <Card padding={spacing.xs} style={styles.calendarCardCompact}>
              <Calendar
                key="compact"
                current={`${store.currentMonth}-01`}
                monthFormat="yyyy년 M월"
                firstDay={0}
                onDayPress={handleDayPress}
                onMonthChange={handleMonthChange}
                maxDate={today}
                hideExtraDays
                theme={CALENDAR_THEME_COMPACT}
                dayComponent={({ date }) => (
                  <CalendarDay
                    date={date}
                    entriesByDate={store.entriesByDate}
                    selectedDate={store.selectedDate}
                    today={today}
                    onPress={handleDayPress}
                    compact
                  />
                )}
              />
            </Card>
          ) : (
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
          )}

          {momentsHeader}

          {store.selectedDate && !store.selectedLoading && (
            store.selectedEntries.length > 0 ? (
              <View style={styles.momentsExpanded}>
                <MomentsRow
                  items={store.selectedEntries}
                  onPressItem={(entryId) => router.push(`/entry/${entryId}`)}
                  mode="grid"
                  bottomInset={tabBarHeight}
                />
              </View>
            ) : (
              <View style={styles.empty}>
                <AppText preset="bodyMedium" color={colors.text.tertiary}>해당 날짜에 기록이 없어요</AppText>
              </View>
            )
          )}
          {store.selectedLoading && (
            <View style={styles.centeredRow}><ActivityIndicator color={colors.brand.primary} /></View>
          )}
        </View>
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

  // ── 공통 ────────────────────────────────────────────────────────────────────
  empty: { paddingTop: spacing['4xl'], alignItems: 'center' },
  listContent: { paddingHorizontal: layout.screenPaddingX },
});

