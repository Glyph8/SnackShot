import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

interface Props {
  decision: Decision;
  onResult(result: 'good' | 'bad' | 'skipped'): void;
}

export function FollowUpCard({ decision, onResult }: Props) {
  const displaySummary = decision.userSummary ?? decision.summary;
  const dueLabel = decision.followUpAt
    ? format(new Date(decision.followUpAt), 'M월 d일', { locale: ko })
    : null;

  return (
    <Card style={styles.card}>
      <View style={styles.accent} />
      {dueLabel && <AppText preset="caption" color={colors.feedback.warning}>{dueLabel} 예정</AppText>}
      <AppText preset="titleMedium">{displaySummary}</AppText>
      <AppText preset="bodySmall" color={colors.text.secondary}>결과가 어땠어요?</AppText>

      <View style={styles.grid}>
        <Pressable style={[styles.btn, { backgroundColor: colors.feedback.successTrack }]} onPress={() => onResult('good')}>
          <AppText preset="bodySmall" color={colors.feedback.success}>좋았음 👍</AppText>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: colors.feedback.warningTrack }]} onPress={() => onResult('bad')}>
          <AppText preset="bodySmall" color={colors.feedback.danger}>아쉬움 👎</AppText>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: colors.surface.sunken }]} onPress={() => onResult('skipped')}>
          <AppText preset="bodySmall" color={colors.text.secondary}>기억 안 남</AppText>
        </Pressable>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.brand.tint }]}
          onPress={() => router.push({ pathname: '/record', params: { decisionId: decision.id } })}
        >
          <AppText preset="bodySmall" color={colors.brand.primary}>영상으로 ▸</AppText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm, overflow: 'hidden' },
  accent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: colors.feedback.warning,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1, minWidth: '45%', paddingVertical: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
});
