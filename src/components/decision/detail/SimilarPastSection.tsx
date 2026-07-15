import { Pressable, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText } from '@/components/ui';
import type { SimilarPastItem } from '@/db';
import type { OutcomeResult } from '@/types/domain';
import { colors, radius, spacing } from '@/theme';

// I1: 비슷했던 과거 결정 — 배지가 아니라 상시 섹션으로 렌더(F1 getSimilarPastDecisions 결과).
// 항목 탭 → 그 결정의 상세로 push(스택 중첩 허용).

const RESULT_LABEL: Record<OutcomeResult, string> = {
  good: '좋았음 👍', bad: '아쉬움 👎', mixed: '반반 🤔', unclear: '기억 안 남', skipped: '건너뜀',
};

export function SimilarPastSection({
  items, onPressItem,
}: {
  items: SimilarPastItem[];
  onPressItem(id: string): void;
}) {
  return (
    <View style={styles.wrap}>
      <AppText preset="caption" color={colors.text.tertiary}>비슷했던 과거 결정</AppText>
      {items.length === 0 ? (
        <AppText preset="bodySmall" color={colors.text.tertiary}>아직 비슷한 기록 없음</AppText>
      ) : (
        items.map((it) => {
          const summary = it.decision.userSummary ?? it.decision.summary;
          return (
            <Pressable key={it.decision.id} style={styles.row} onPress={() => onPressItem(it.decision.id)}>
              <View style={styles.rowHead}>
                <AppText preset="caption" color={colors.text.tertiary}>
                  {decisionCategoryLabel(it.decision)}
                </AppText>
                {it.result && (
                  <AppText preset="caption" color={colors.text.secondary}>{RESULT_LABEL[it.result]}</AppText>
                )}
              </View>
              <AppText preset="bodyMedium" numberOfLines={2}>{summary}</AppText>
              {it.learnings ? (
                <AppText preset="caption" color={colors.text.secondary}>{`교훈: ${it.learnings}`}</AppText>
              ) : null}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
