import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { colors, iconSize, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

interface Props {
  decision: Decision;
  /** 체크 취소 — 다시 진행 중으로 */
  onUncheck(): void;
  /** 결과/회고 기록 — 인라인 편집기(OutcomeEditor) 펼치기 */
  onRecord(): void;
}

/**
 * 수행 완료된 결정의 압축 체크행 (v8 Phase 4.1).
 * 체크 아이콘 = 취소, 본문 탭 = 결과·회고 기록. 진행 중 목록에 작게 남는다.
 */
export function DecisionDoneRow({ decision, onUncheck, onRecord }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  return (
    <Card padding={spacing.md} style={styles.row}>
      <Pressable onPress={onUncheck} hitSlop={spacing.sm} accessibilityLabel="체크 취소">
        <Ionicons name="checkmark-circle" size={iconSize.lg} color={colors.brand.primary} />
      </Pressable>
      <Pressable onPress={onRecord} style={styles.body}>
        <AppText preset="bodyMedium" color={colors.text.tertiary} numberOfLines={1} style={styles.done}>
          {summary}
        </AppText>
      </Pressable>
      <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.text.tertiary} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginBottom: spacing.sm,
  },
  body: { flex: 1 },
  done: { textDecorationLine: 'line-through' },
});
