import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, Pin } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { colors, iconSize, radius, spacing } from '@/theme';

// 캡처 저장 화면의 '중요 결정 포함' 토글 — 메모와 같은 위계로 묻혀 있던 체크박스를
// 압정·형광펜 강조 카드로 격상(P1). 켜면 결정 추출이 돈다는 의미를 분명히 전달.
interface Props {
  value: boolean;
  onToggle(): void;
}

export function DecisionHintCard({ value, onToggle }: Props) {
  return (
    <Pressable onPress={() => { haptics.selection(); onToggle(); }} style={[styles.card, value && styles.cardOn]} accessibilityRole="switch">
      {value && <Pin size={22} vary="decision-hint" style={styles.pin} />}
      <View style={styles.texts}>
        <AppText preset="titleMedium">중요 결정 포함</AppText>
        <AppText preset="caption" color={colors.text.secondary}>
          켜면 이 기록에서 의사결정을 자동으로 찾아줘요
        </AppText>
      </View>
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value && <Icon name="check" size={iconSize.sm} color={colors.brand.onPrimary} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface.paper, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.card, padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardOn: { backgroundColor: colors.accent.highlight, borderColor: colors.border.dashed, borderStyle: 'dashed' },
  pin: { position: 'absolute', top: -spacing.xs, left: spacing.lg },
  texts: { flex: 1, gap: spacing.xs },
  checkbox: {
    width: 24, height: 24, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border.card,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
});
