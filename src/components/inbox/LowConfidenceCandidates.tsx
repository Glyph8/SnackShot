import { StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Button, CollapsibleSection, Tag } from '@/components/ui';
import type { DecisionWithEntry } from '@/stores/inbox';
import { colors, radius, spacing } from '@/theme';

// E2(b) — 낮은 확신(<0.6) 추출 후보를 덱에서 분리해 접힘 그룹으로 보여준다(과추출 노이즈 억제).
// 저장은 그대로(ADR-016 원본 보존), 표시만 억제. 각 후보는 덱과 동일한 확정/수정/반려 동작.

interface Props {
  items: DecisionWithEntry[];
  onConfirm(item: DecisionWithEntry): void;
  onReject(item: DecisionWithEntry): void;
  onEdit(item: DecisionWithEntry): void;
}

export function LowConfidenceCandidates({ items, onConfirm, onReject, onEdit }: Props) {
  if (items.length === 0) return null;
  return (
    <CollapsibleSection title={`낮은 확신 후보 ${items.length}건`} hint="기본 접힘">
      <View style={styles.list}>
        {items.map((item) => {
          const { decision } = item;
          const summary = decision.userSummary ?? decision.summary;
          return (
            <View key={decision.id} style={styles.card}>
              <View style={styles.topRow}>
                <Tag label={decisionCategoryLabel(decision)} />
                <AppText preset="caption" color={colors.text.tertiary}>
                  {`확신 ${Math.round(decision.confidence * 100)}%`}
                </AppText>
              </View>
              <AppText preset="bodyMedium" numberOfLines={3}>{summary}</AppText>
              <View style={styles.actions}>
                <Button label="반려" variant="quiet" size="sm" onPress={() => onReject(item)} />
                <Button label="수정" variant="secondary" size="sm" onPress={() => onEdit(item)} />
                <Button label="확정" size="sm" onPress={() => onConfirm(item)} style={styles.flex1} />
              </View>
            </View>
          );
        })}
      </View>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.card, backgroundColor: colors.surface.paper,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex1: { flex: 1 },
});
