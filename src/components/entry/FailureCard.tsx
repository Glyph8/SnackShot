import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { JOB_STAGE_LABEL, type ClassifiedError } from '@/services/jobs/errors';
import { colors, spacing } from '@/theme';
import type { AiJobType } from '@/types/domain';

// entry/[id].tsx에서 분리 (P3). 처리 실패 단계 표시 + 재시도 — 순수 프레젠테이션.

export type Failure = { type: AiJobType; info: ClassifiedError };

export interface FailureCardProps {
  failures: Failure[];
  onRetry(type: AiJobType): void;
}

export function FailureCard({ failures, onRetry }: FailureCardProps) {
  if (failures.length === 0) return null;
  return (
    <Card style={styles.failCard}>
      <AppText preset="caption" color={colors.feedback.danger} style={styles.sectionTitle}>처리 실패</AppText>
      {failures.map((f) => (
        <View key={f.type} style={styles.failRow}>
          <View style={styles.failText}>
            <AppText preset="bodyMedium">{`${JOB_STAGE_LABEL[f.type]} — ${f.info.why}`}</AppText>
            <AppText preset="caption" color={colors.text.secondary}>{f.info.how}</AppText>
          </View>
          <Button label="재시도" variant="secondary" size="sm" onPress={() => onRetry(f.type)} />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  failCard: { gap: spacing.sm, marginBottom: spacing.md, borderColor: colors.feedback.warning },
  failRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  failText: { flex: 1, gap: spacing.xs },
  sectionTitle: { letterSpacing: 0.5 },
});
