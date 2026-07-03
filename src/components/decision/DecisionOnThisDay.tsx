import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Pin, Tag } from '@/components/ui';
import { colors, radius, shadow, spacing } from '@/theme';
import type { Decision, Outcome } from '@/types/domain';

// n년 전 오늘 확정된 결정 회상 스트립 (D4-c) — OnThisDayStrip 패턴 재사용. 비면 렌더 안 함.

export interface DecisionOnThisDayItem {
  decision: Decision;
  outcome: Outcome | null;
}

const RESULT_META: Record<string, { label: string; color: string }> = {
  good: { label: '좋았음', color: colors.feedback.success },
  bad: { label: '아쉬움', color: colors.feedback.danger },
  mixed: { label: '반반', color: colors.feedback.warning },
  unclear: { label: '불명확', color: colors.text.tertiary },
  skipped: { label: '건너뜀', color: colors.text.tertiary },
};

interface Props {
  items: DecisionOnThisDayItem[];
  onPress(decision: Decision): void;
}

export function DecisionOnThisDay({ items, onPress }: Props) {
  if (items.length === 0) return null;
  const nowYear = new Date().getFullYear();

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pin size={20} vary="decision-on-this-day" />
        <AppText preset="titleMedium">이날의 결정</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map(({ decision, outcome }) => {
          const summary = decision.userSummary ?? decision.summary;
          const yearsAgo = decision.confirmedAt
            ? nowYear - new Date(decision.confirmedAt).getFullYear()
            : 0;
          const rm = outcome ? RESULT_META[outcome.result] : null;
          return (
            <Pressable key={decision.id} style={styles.card} onPress={() => onPress(decision)}>
              <AppText preset="caption" color={colors.text.tertiary}>
                {yearsAgo > 0 ? `${yearsAgo}년 전` : '올해'}
              </AppText>
              <AppText preset="bodyMedium" numberOfLines={2} style={styles.summary}>{summary}</AppText>
              <View style={styles.metaRow}>
                <Tag label={decisionCategoryLabel(decision)} />
                {rm && <AppText preset="caption" color={rm.color}>{rm.label}</AppText>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  row: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs, paddingRight: spacing.md },
  card: {
    width: 180, gap: spacing.xs, padding: spacing.md,
    backgroundColor: colors.surface.paperRaised, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.card, ...shadow.card,
  },
  summary: { minHeight: 40 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
