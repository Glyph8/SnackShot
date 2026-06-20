import {
  differenceInCalendarDays, differenceInCalendarWeeks, format, isYesterday, startOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { StyleSheet, View } from 'react-native';

import { AppText, Pin } from '@/components/ui';
import { colors, spacing } from '@/theme';

// 타임라인 시간 구분선. 최근은 일 단위, 오래될수록 주→월→년으로 묶고(coarsen)
// 레벨마다 다른 시각 스타일을 줘 한눈에 시간대를 구분하게 한다.
export type TimelineLevel = 'today' | 'day' | 'week' | 'month' | 'year';

// 타임스탬프 → 버킷(레벨·그룹키·라벨). 그룹키가 바뀌는 지점에만 구분선을 끼운다.
export function bucketFor(ts: number, now: Date): { level: TimelineLevel; key: string; label: string } {
  const d = new Date(ts);
  const diffDays = differenceInCalendarDays(now, d);
  if (diffDays <= 0) return { level: 'today', key: 'today', label: '오늘' };
  if (diffDays <= 6) {
    return {
      level: 'day',
      key: `d:${format(d, 'yyyy-MM-dd')}`,
      label: isYesterday(d) ? '어제' : format(d, 'M월 d일 EEEE', { locale: ko }),
    };
  }
  if (d.getFullYear() === now.getFullYear()) {
    const weeksAgo = differenceInCalendarWeeks(now, d, { weekStartsOn: 0 });
    if (weeksAgo <= 4) {
      return {
        level: 'week',
        key: `w:${format(startOfWeek(d, { weekStartsOn: 0 }), 'yyyy-MM-dd')}`,
        label: weeksAgo <= 1 ? '지난주' : `${weeksAgo}주 전`,
      };
    }
    return { level: 'month', key: `m:${format(d, 'yyyy-MM')}`, label: format(d, 'M월') };
  }
  return { level: 'year', key: `y:${format(d, 'yyyy')}`, label: format(d, 'yyyy년') };
}

export function TimelineSeparator({ level, label }: { level: TimelineLevel; label: string }) {
  if (level === 'today') {
    return (
      <View style={styles.todayWrap}>
        <Pin size={14} />
        <AppText preset="displayCompact" color={colors.brand.primary}>{label}</AppText>
      </View>
    );
  }
  if (level === 'day') {
    return (
      <View style={styles.dayWrap}>
        <View style={styles.dayDot} />
        <AppText preset="titleMedium">{label}</AppText>
      </View>
    );
  }
  if (level === 'week') {
    return (
      <View style={styles.weekWrap}>
        <AppText preset="caption" color={colors.text.secondary}>{label}</AppText>
        <View style={styles.hairline} />
      </View>
    );
  }
  if (level === 'month') {
    return (
      <View style={styles.monthWrap}>
        <View style={styles.hairline} />
        <AppText preset="titleMedium" color={colors.text.secondary}>{label}</AppText>
        <View style={styles.hairline} />
      </View>
    );
  }
  // year — 가장 큰 시간 도약. 손글씨 대제목 + 굵은 선으로 강한 구획.
  return (
    <View style={styles.yearWrap}>
      <AppText preset="displayMedium" color={colors.text.primary}>{label}</AppText>
      <View style={styles.yearRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  todayWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  dayWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  dayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.primary },
  weekWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  monthWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  hairline: { flex: 1, height: 1, backgroundColor: colors.border.hairline },
  yearWrap: { marginTop: spacing['2xl'], marginBottom: spacing.sm, gap: spacing.xs },
  yearRule: { height: 2, backgroundColor: colors.border.card },
});
