import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';

// 아카이브 빈 상태 — 밋밋한 한 줄 텍스트를 아이콘 + (선택)CTA로. 다음 행동을 안내.
interface Props {
  icon: IconName;
  message: string;
  ctaLabel?: string;
  onCta?(): void;
}

export function ArchiveEmpty({ icon, message, ctaLabel, onCta }: Props) {
  return (
    <View style={styles.wrap}>
      <Icon name={icon} size={40} color={colors.text.tertiary} />
      <AppText preset="bodyMedium" color={colors.text.tertiary} style={styles.msg}>{message}</AppText>
      {ctaLabel && onCta && (
        <Pressable onPress={onCta} style={styles.cta} accessibilityRole="button">
          <Icon name="add" size={iconSize.sm} color={colors.brand.onPrimary} />
          <AppText preset="button" color={colors.brand.onPrimary}>{ctaLabel}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing['4xl'] },
  msg: { textAlign: 'center' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill,
  },
});
