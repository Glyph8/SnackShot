import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';
import type { DateData } from 'react-native-calendars';

import { AppText, HandDrawnArrow } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';

// 아카이브 캘린더 표현 컴포넌트 (archive.tsx에서 분리, P3-1).
// PhotoStack(내부) → CalendarDay → WeekStrip. store/db 의존 없음 — 순수 프레젠테이션.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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

export function CalendarDay({ date, entriesByDate, selectedDate, today, onPress, compact }: CalendarDayProps) {
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

export function WeekStrip({ anchor, entriesByDate, selectedDate, today, onPressDay, onShiftWeek }: WeekStripProps) {
  const start = startOfWeek(parseISO(anchor), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={dayStyles.weekWrap}>
      <View style={dayStyles.weekHeaderRow}>
        <Pressable onPress={() => onShiftWeek(-7)} hitSlop={spacing.sm}>
          <HandDrawnArrow direction="left" size={iconSize.md} color={colors.text.tertiary} />
        </Pressable>
        <AppText preset="caption" color={colors.text.secondary}>
          {format(start, 'M월 d일')} – {format(addDays(start, 6), 'M월 d일')}
        </AppText>
        <Pressable onPress={() => onShiftWeek(7)} hitSlop={spacing.sm}>
          <HandDrawnArrow direction="right" size={iconSize.md} color={colors.text.tertiary} />
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
