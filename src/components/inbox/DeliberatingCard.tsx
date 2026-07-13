import { StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Button, Tag } from '@/components/ui';
import type { Decision } from '@/types/domain';
import { colors, radius, spacing } from '@/theme';

// F5/ADR-028: 미결(deliberating) 결정 카드 — "고민 중" 보드 섹션.
// 마감(decide_by)이 있으면 D-n, 지났으면 경과 강조. 액션: 결정했다 / 접기.

const DAY_MS = 86_400_000;

interface Props {
  decision: Decision;
  onDecide(): void;
  onDiscard(): void;
}

function deadlineLabel(decideBy?: number): { text: string; overdue: boolean } | null {
  if (decideBy == null) return null;
  const days = Math.ceil((decideBy - Date.now()) / DAY_MS);
  if (days < 0) return { text: '마감 지남', overdue: true };
  if (days === 0) return { text: '오늘 마감', overdue: true };
  return { text: `마감 D-${days}`, overdue: false };
}

export function DeliberatingCard({ decision, onDecide, onDiscard }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  const deadline = deadlineLabel(decision.decideBy);
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Tag label={decisionCategoryLabel(decision)} />
        {deadline && (
          <AppText
            preset="caption"
            color={deadline.overdue ? colors.accent.pin : colors.text.secondary}
          >
            {deadline.text}
          </AppText>
        )}
      </View>
      <AppText preset="bodyMedium" numberOfLines={3}>{summary}</AppText>
      {decision.situation ? (
        <AppText preset="caption" color={colors.text.tertiary} numberOfLines={2}>
          {decision.userSituation ?? decision.situation}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button label="접기" variant="quiet" size="sm" onPress={onDiscard} />
        <Button label="결정했다" size="sm" onPress={onDecide} style={styles.flex1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.card, backgroundColor: colors.surface.paper,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex1: { flex: 1 },
});
