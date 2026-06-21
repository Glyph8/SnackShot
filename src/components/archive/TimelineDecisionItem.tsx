import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Card, ConfidenceBar, Pin, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

// 타임라인 인레이 — 의사결정을 Entry와 같은 시간축에 다른 '비트'로 표시.
// 좌측 강조선 + 압정으로 Entry 카드와 시각적으로 구분한다. 탭 → 결정 수정 시트.
interface Props {
  decision: Decision;
  sortTs: number;
  onPress(): void;
}

export function TimelineDecisionItem({ decision, sortTs, onPress }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  const statusLabel = decision.executedAt ? '완료' : '확정';
  const dateLabel = format(new Date(sortTs), 'yyyy년 M월 d일', { locale: ko });

  return (
    <View style={styles.wrap}>
      <View style={styles.pin} pointerEvents="none"><Pin size={20} vary={decision.id} /></View>
      <Pressable onPress={onPress}>
        <Card style={styles.card}>
          <View style={styles.topRow}>
            <AppText preset="caption" color={colors.brand.primary}>{`결정 · ${statusLabel}`}</AppText>
            <AppText preset="caption" color={colors.text.tertiary}>{dateLabel}</AppText>
          </View>
          <AppText preset="cardTitle" numberOfLines={2}>{summary}</AppText>
          <View style={styles.metaRow}>
            <Tag label={decisionCategoryLabel(decision)} />
            <ConfidenceBar value={Math.round(decision.confidence * 100)} style={styles.conf} />
          </View>
        </Card>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, marginBottom: spacing.md },
  pin: { position: 'absolute', top: -spacing.xs, left: spacing.lg, zIndex: 2 },
  card: {
    gap: spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.brand.primary, borderRadius: radius.lg,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  conf: { flex: 1 },
});
