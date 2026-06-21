import { Icon } from '@/components/ui';
import { format, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, HandDrawnBorder, Highlight, Pin } from '@/components/ui';
import { colors, iconSize, layout, opacity, radius, spacing } from '@/theme';

// today.tsx에서 분리 (P3). 날짜·뷰모드·검색 + 결정 배너 — 순수 프레젠테이션.

export interface TodayHeaderProps {
  viewDateObj: Date;
  isTodayDate: boolean;
  viewMode: 'list' | 'diary';
  decisionCount: number;
  onPrevDay(): void;
  onNextDay(): void;
  onToggleViewMode(): void;
  onOpenArchive(): void;
  onOpenInbox(): void;
}

export function TodayHeader({
  viewDateObj, isTodayDate, viewMode, decisionCount,
  onPrevDay, onNextDay, onToggleViewMode, onOpenArchive, onOpenInbox,
}: TodayHeaderProps) {
  // 날짜 위계: 큰 제목은 의미 라벨(오늘/어제/날짜), 보조줄은 중복 없는 전체 맥락.
  const yesterday = isYesterday(viewDateObj);
  const titleLabel = isTodayDate ? '오늘' : yesterday ? '어제' : format(viewDateObj, 'M월 d일', { locale: ko });
  // 오늘/어제는 라벨이 단어라 전체 날짜를 그대로 보조줄에 둔다(숫자 중복 없음).
  // 그 외 날짜는 제목이 'M월 d일'이므로 보조줄은 연도+요일만(월·일 중복 제거).
  const subtitle = isTodayDate || yesterday
    ? format(viewDateObj, 'yyyy년 M월 d일 EEEE', { locale: ko })
    : format(viewDateObj, 'yyyy년 · EEEE', { locale: ko });

  return (
    <View>
      <AppText preset="caption" color={colors.text.secondary} style={styles.dateLine}>
        {subtitle}
      </AppText>

      <View style={styles.titleRow}>
        <View style={styles.navRow}>
          <Pressable onPress={onPrevDay} hitSlop={spacing.xs} style={styles.navBtn} accessibilityLabel="이전 날">
            <Icon name="back" size={iconSize.md} color={colors.text.secondary} />
          </Pressable>
          <Highlight vary="today-title">
            <AppText preset="displayCompact">{titleLabel}</AppText>
          </Highlight>
          <Pressable
            onPress={onNextDay}
            hitSlop={spacing.xs}
            disabled={isTodayDate}
            style={[styles.navBtn, isTodayDate && styles.navBtnDisabled]}
            accessibilityLabel="다음 날"
          >
            <Icon
              name="forward"
              size={iconSize.md}
              color={isTodayDate ? colors.text.tertiary : colors.text.secondary}
            />
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onToggleViewMode} hitSlop={spacing.sm}>
            <AppText preset="caption" color={colors.text.link}>
              {viewMode === 'list' ? '일기 보기' : '목록 보기'}
            </AppText>
          </Pressable>
          <Pressable onPress={onOpenArchive} hitSlop={spacing.sm}>
            <Icon name="search" size={iconSize.md} color={colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      {decisionCount > 0 && (
        <Pressable onPress={onOpenInbox} style={styles.banner}>
          <HandDrawnBorder shape="box" dashed radius={radius.md} color={colors.border.dashed} />
          <Pin size={22} vary="today-banner" style={styles.bannerPin} />
          <AppText preset="bodyMedium" color={colors.text.primary} style={styles.bannerText}>
            {`오늘 기록에서 결정 ${decisionCount}건을 찾았어요 — Inbox에서 확인!`}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dateLine: { marginTop: layout.headerPaddingTop },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.xs, marginBottom: spacing.lg,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  navBtn: {
    width: layout.minTouch, height: layout.minTouch, borderRadius: radius.pill,
    backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.card,
  },
  navBtnDisabled: { opacity: opacity.disabled },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.accent.highlight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerPin: { marginTop: -spacing.xs },
  bannerText: { flex: 1 },
});
