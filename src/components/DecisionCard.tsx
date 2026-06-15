import { StyleSheet, View } from 'react-native';

import { DecisionCardBody } from '@/components/DecisionCardBody';
import { Button, Card } from '@/components/ui';
import { spacing } from '@/theme';
import type { Decision, Entry } from '@/types/domain';

interface Props {
  decision: Decision;
  entry?: Entry;
  onConfirm(): void;
  onReject(): void;
  onEdit(): void;
}

/** 리스트 모드 결정 카드 — 본문 + 인라인 액션(결정 아님 / 수정 / 컨펌). */
export function DecisionCard({ decision, entry, onConfirm, onReject, onEdit }: Props) {
  return (
    <Card style={styles.card}>
      <DecisionCardBody decision={decision} entry={entry} />
      <View style={styles.actions}>
        <Button label="결정 아님" variant="destructive" size="sm" onPress={onReject} style={styles.flex1} />
        <Button label="수정" variant="secondary" size="sm" onPress={onEdit} style={styles.flex1} />
        <Button label="컨펌 ✓" variant="primary" size="sm" onPress={onConfirm} style={styles.flexWide} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex1: { flex: 1 },
  flexWide: { flex: 1.4 },
});
