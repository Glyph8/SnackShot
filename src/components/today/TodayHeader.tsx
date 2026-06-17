import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Pin } from '@/components/ui';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

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
  return (
    <View>
      <AppText preset="caption" color={colors.text.secondary} style={styles.dateLine}>
        {format(viewDateObj, 'yyyy년 M월 d일 EEEE', { locale: ko })}
      </AppText>

      <View style={styles.titleRow}>
        <View style={styles.navRow}>
          <Pressable onPress={onPrevDay} hitSlop={spacing.md}>
            <Ionicons name="chevron-back" size={iconSize.md} color={colors.text.tertiary} />
          </Pressable>
          <AppText preset="displayLarge">{isTodayDate ? '오늘의 일기' : format(viewDateObj, 'M월 d일')}</AppText>
          <Pressable onPress={onNextDay} hitSlop={spacing.md} disabled={isTodayDate}>
            <Ionicons
              name="chevron-forward"
              size={iconSize.md}
              color={isTodayDate ? colors.border.dashed : colors.text.tertiary}
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
            <Ionicons name="search" size={iconSize.md} color={colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      {decisionCount > 0 && (
        <Pressable onPress={onOpenInbox} style={styles.banner}>
          <Pin size={16} style={styles.bannerPin} />
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.accent.highlight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.dashed,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerPin: { marginTop: -spacing.xs },
  bannerText: { flex: 1 },
});
