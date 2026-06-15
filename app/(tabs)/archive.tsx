import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, LayoutAnimation, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, UIManager, View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

import { EntryCard } from '@/components/EntryCard';
import { MomentsRow } from '@/components/MomentsRow';
import { AppText, Button, Card, ScreenBackground } from '@/components/ui';
import type { SearchResult } from '@/db/repos/transcripts';
import { useArchiveStore } from '@/stores/archive';
import type { EntryWithTranscript } from '@/stores/archive';
import { useTodayStore } from '@/stores/today';
import { colors, fontFamily, iconSize, layout, radius, spacing } from '@/theme';

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
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// FlatList 아이템 타입 — 검색/캘린더 모드 통합
type CalItem = { _k: 'cal' } & EntryWithTranscript;
type SrchItem = { _k: 'srch' } & SearchResult;
type ListItem = CalItem | SrchItem;

// ─── 커스텀 캘린더 날짜: 폴라로이드 스택 마커 ────────────────────────────────
/** 기록 수만큼 겹친 미니 폴라로이드. 2장 이상은 뒤 카드 + "+N" 배지. */
function PhotoStack({ count }: { count: number }) {
  return (
    <View style={dayStyles.stack}>
      {count >= 2 && <View style={[dayStyles.card, dayStyles.cardBack]} />}
      <View style={[dayStyles.card, dayStyles.cardFront]} />
      {count > 1 && (
        <View style={dayStyles.badge}>
          <AppText preset="micro" color={colors.brand.onPrimary}>{`+${count - 1}`}</AppText>
        </View>
      )}
    </View>
  );
}

interface CalendarDayProps {
  date?: DateData;
  entriesByDate: Record<string, number>;
  selectedDate: string | null;
  today: string;
  onPress: (d: DateData) => void;
  /** 압축 모드 — 작은 셀 + 단순 점 마커 */
  compact?: boolean;
}

function CalendarDay({ date, entriesByDate, selectedDate, today, onPress, compact }: CalendarDayProps) {
  if (!date) return <View style={[dayStyles.cell, compact && dayStyles.cellCompact]} />;
  const ds = date.dateString;
  const count = entriesByDate[ds] ?? 0;
  const disabled = ds > today;
  const selected = ds === selectedDate;
  const isToday = ds === today;
  const numColor = disabled
    ? colors.border.dashed
    : selected
      ? colors.brand.onPrimary
      : isToday
        ? colors.brand.primary
        : colors.text.primary;

  // 압축 모드: 마커 슬롯 없이 숫자를 둘러싸는 링으로 기록 표시
  if (compact) {
    return (
      <Pressable disabled={disabled} hitSlop={spacing.xs} onPress={() => onPress(date)} style={[dayStyles.cell, dayStyles.cellCompact]}>
        <View
          style={[
            dayStyles.numWrap, dayStyles.numWrapCompact,
            count > 0 && !selected && dayStyles.numRing,
            selected && dayStyles.numSelected,
          ]}
        >
          <AppText preset="bodySmall" color={numColor} style={isToday && !selected ? dayStyles.numToday : undefined}>
            {String(date.day)}
          </AppText>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable disabled={disabled} hitSlop={spacing.xs} onPress={() => onPress(date)} style={dayStyles.cell}>
      <View style={[dayStyles.numWrap, selected && dayStyles.numSelected]}>
        <AppText preset="bodySmall" color={numColor} style={isToday && !selected ? dayStyles.numToday : undefined}>
          {String(date.day)}
        </AppText>
      </View>
      <View style={dayStyles.markerSlot}>{count > 0 && <PhotoStack count={count} />}</View>
    </Pressable>
  );
}

// ─── 주 단위 스트립 ──────────────────────────────────────────────────────────
interface WeekStripProps {
  anchor: string; // 'yyyy-MM-dd' — 표시할 주의 기준일
  entriesByDate: Record<string, number>;
  selectedDate: string | null;
  today: string;
  onPressDay: (d: DateData) => void;
  onShiftWeek: (deltaDays: number) => void;
}

function WeekStrip({ anchor, entriesByDate, selectedDate, today, onPressDay, onShiftWeek }: WeekStripProps) {
  const start = startOfWeek(parseISO(anchor), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={dayStyles.weekWrap}>
      <View style={dayStyles.weekHeaderRow}>
        <Pressable onPress={() => onShiftWeek(-7)} hitSlop={spacing.sm}>
          <Ionicons name="chevron-back" size={iconSize.md} color={colors.text.tertiary} />
        </Pressable>
        <AppText preset="caption" color={colors.text.secondary}>
          {format(start, 'M월 d일')} – {format(addDays(start, 6), 'M월 d일')}
        </AppText>
        <Pressable onPress={() => onShiftWeek(7)} hitSlop={spacing.sm}>
          <Ionicons name="chevron-forward" size={iconSize.md} color={colors.text.tertiary} />
        </Pressable>
      </View>
      <View style={dayStyles.weekRow}>
        {days.map((d, i) => (
          <View key={d.toISOString()} style={dayStyles.weekCol}>
            <AppText preset="micro" color={colors.text.tertiary}>{WEEKDAYS[i]}</AppText>
            <CalendarDay
              date={{ dateString: format(d, 'yyyy-MM-dd'), day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), timestamp: d.getTime() }}
              entriesByDate={entriesByDate}
              selectedDate={selectedDate}
              today={today}
              onPress={onPressDay}
              compact
            />
          </View>
        ))}
      </View>
    </View>
  );
}

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
          {!isSearchMode && hasEntriesInMonth && (
            <AppText preset="caption" color={colors.text.secondary}>{`이번 달 ${monthTotal}개`}</AppText>
          )}
        </View>

        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Ionicons name="search" size={iconSize.md} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="전문 검색…"
            placeholderTextColor={colors.text.tertiary}
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
            <Pressable onPress={store.clearSearch} hitSlop={spacing.sm}>
              <Ionicons name="close-circle" size={iconSize.md} color={colors.text.tertiary} />
            </Pressable>
          )}
        </View>

        {showHistory && (
          <Card padding={spacing.md} style={styles.historySection}>
            <AppText preset="caption" color={colors.text.tertiary} style={styles.historyLabel}>최근 검색</AppText>
            {store.searchHistory.map((q) => (
              <View key={q} style={styles.historyRow}>
                <Pressable style={styles.historyItemPressable} onPress={() => store.setSearchQuery(db, q)}>
                  <Ionicons name="arrow-undo-outline" size={iconSize.sm} color={colors.text.tertiary} />
                  <AppText preset="bodyMedium" color={colors.text.secondary} numberOfLines={1} style={styles.historyText}>
                    {q}
                  </AppText>
                </Pressable>
                <Pressable onPress={() => store.removeHistory(q)} hitSlop={spacing.sm} style={styles.historyRemove}>
                  <Ionicons name="close" size={iconSize.sm} color={colors.text.tertiary} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        {isSearchMode && (
          <View style={styles.searchStatus}>
            {store.searchLoading ? (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            ) : (
              store.searchResults.length > 0 && (
                <AppText preset="caption" color={colors.text.secondary}>{`${store.searchResults.length}개 결과`}</AppText>
              )
            )}
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
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm,
  },

  // ── 검색바 ──────────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  searchBarFocused: { borderColor: colors.border.card, backgroundColor: colors.surface.paperRaised },
  searchInput: { flex: 1, fontSize: 15, color: colors.text.primary, padding: 0 },

  // ── 히스토리 ────────────────────────────────────────────────────────────────
  historySection: { marginBottom: spacing.sm },
  historyLabel: { marginBottom: spacing.sm },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border.hairline,
  },
  historyItemPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  historyText: { flex: 1 },
  historyRemove: { paddingLeft: spacing.md },

  // ── 검색 결과 헤더 ─────────────────────────────────────────────────────────
  searchStatus: { paddingVertical: spacing.sm, minHeight: 36, justifyContent: 'center' },

  // ── 캘린더 ──────────────────────────────────────────────────────────────────
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

// 커스텀 날짜 셀 — 폴라로이드 스택 마커
const dayStyles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.xs, minHeight: 46, gap: spacing.xs },
  cellCompact: { minHeight: 30, paddingTop: 0, gap: 0, justifyContent: 'center' },
  numWrap: { width: 26, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  numWrapCompact: { width: 28, height: 28 },
  numRing: { borderWidth: 1.5, borderColor: colors.brand.primary },
  numSelected: { backgroundColor: colors.brand.primary, borderWidth: 0 },
  numToday: { textDecorationLine: 'underline' },
  markerSlot: { height: 18, justifyContent: 'center' },
  // 주 단위 스트립
  weekWrap: { gap: spacing.xs },
  weekHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingBottom: spacing.xs,
  },
  weekRow: { flexDirection: 'row' },
  weekCol: { flex: 1, alignItems: 'center', gap: 2 },
  stack: { width: 26, height: 18, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute', width: 18, height: 13, borderRadius: radius.xs,
    borderWidth: 1, borderColor: colors.surface.paperRaised,
  },
  cardFront: { backgroundColor: colors.media.thumbSlate, zIndex: 2 },
  cardBack: { backgroundColor: colors.media.thumbNavy, zIndex: 1, transform: [{ rotate: '-12deg' }, { translateX: -3 }] },
  badge: {
    position: 'absolute', top: -6, right: -7, zIndex: 3,
    minWidth: 15, height: 15, borderRadius: radius.pill,
    backgroundColor: colors.accent.pin, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
});
