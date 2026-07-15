import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { PrincipleWatchResult } from '@/services/trade/principleWatch';
import { colors, radius, spacing } from '@/theme';

// I3(c)3: 매매 원칙 섹션 — Profile.md 원칙 원문 + 상시 대조 충돌(경고 카드).
//   watch가 null(vault 미연동·키 없음·실패)이면 섹션 전체 숨김(조용, 표시 기능이므로).
//   H0: 표시만 — 저장·행동 차단 없음.

interface Props {
  watch: PrincipleWatchResult | null;
  principlesText: string | null;
}

export function PrincipleWatchSection({ watch, principlesText }: Props) {
  if (!watch) return null;
  const { conflicts } = watch;

  return (
    <View style={styles.wrap}>
      <AppText preset="caption" color={colors.text.tertiary}>매매 원칙</AppText>

      {principlesText ? (
        <AppText preset="bodySmall" color={colors.text.secondary}>{principlesText}</AppText>
      ) : null}

      {conflicts.length === 0 ? (
        <AppText preset="bodyMedium" color={colors.feedback.success}>원칙과 충돌 없음 ✓</AppText>
      ) : (
        conflicts.map((c, i) => (
          <View key={`${c.rule}-${i}`} style={styles.conflict}>
            <AppText preset="bodyMedium" color={colors.feedback.danger}>{c.rule}</AppText>
            <AppText preset="bodySmall" color={colors.text.secondary}>{c.issue}</AppText>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  conflict: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feedback.warning,
    backgroundColor: colors.feedback.warningTrack,
  },
});
