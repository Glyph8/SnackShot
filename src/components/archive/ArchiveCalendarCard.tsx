import { StyleSheet, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

import { CalendarDay } from '@/components/archive/CalendarParts';
import { Card, HandDrawnArrow, PaperCurl, Tape } from '@/components/ui';
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

// 개월 이동 화살표 — 손으로 쓴 화살표(터치 영역 44pt 확보)
function renderCalendarArrow(direction: 'left' | 'right') {
  return (
    <View style={styles.calArrow}>
      <HandDrawnArrow direction={direction} size={iconSize.lg} color={colors.brand.primary} />
    </View>
  );
}

interface Props {
  currentMonth: string; // 'yyyy-MM'
  today: string; // 'yyyy-MM-dd'
  entriesByDate: Record<string, number>;
  selectedDate: string | null;
  onDayPress(day: DateData): void;
  onMonthChange(month: DateData): void;
}

// 월 캘린더 카드 — 테이프·종이 말림 디테일을 포함한 순수 표현 컴포넌트.
// 상태/데이터 로드는 부모(archive 화면)가 props로 주입.
export function ArchiveCalendarCard({
  currentMonth, today, entriesByDate, selectedDate, onDayPress, onMonthChange,
}: Props) {
  return (
    <View style={styles.calendarWrap}>
      <View style={styles.calTapeLeft} pointerEvents="none"><Tape width={58} height={20} angle={-24} vary="cal-tl" /></View>
      <View style={styles.calTapeRight} pointerEvents="none"><Tape width={58} height={20} angle={24} vary="cal-tr" /></View>
      <Card padding={spacing.sm} raised style={styles.calendarCard}>
        <Calendar
          key="full"
          current={`${currentMonth}-01`}
          monthFormat="yyyy년 M월"
          firstDay={0}
          onDayPress={onDayPress}
          onMonthChange={onMonthChange}
          maxDate={today}
          theme={CALENDAR_THEME}
          renderArrow={renderCalendarArrow}
          dayComponent={({ date }) => (
            <CalendarDay
              date={date}
              entriesByDate={entriesByDate}
              selectedDate={selectedDate}
              today={today}
              onPress={onDayPress}
            />
          )}
        />
      </Card>
      {/* 바닥 모서리가 배경에서 살짝 말려 올라간 디테일 */}
      <PaperCurl side="left" size={38} style={styles.calCurlLeft} />
      <PaperCurl side="right" size={38} style={styles.calCurlRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  calendarWrap: { marginTop: spacing.sm, marginBottom: spacing.md },
  calTapeLeft: { position: 'absolute', top: -spacing.sm, left: spacing.md, zIndex: 2 },
  calTapeRight: { position: 'absolute', top: -spacing.sm, right: spacing.md, zIndex: 2 },
  // 달력처럼 각진 모서리
  calendarCard: { borderRadius: radius.xs },
  // 바닥 모서리 종이 말림
  calCurlLeft: { position: 'absolute', left: -1, bottom: -2, zIndex: 1 },
  calCurlRight: { position: 'absolute', right: -1, bottom: -2, zIndex: 1 },
  calArrow: {
    width: layout.minTouch, height: layout.minTouch,
    alignItems: 'center', justifyContent: 'center',
  },
});
