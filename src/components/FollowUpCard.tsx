import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, PostIt } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

interface Props {
  decision: Decision;
  onResult(result: 'good' | 'bad' | 'skipped'): void;
  /** 결과 시트 열기 — 텍스트 회고·영상 기록 (v8 Phase 4.1) */
  onMemo(): void;
}

export function FollowUpCard({ decision, onResult, onMemo }: Props) {
  const displaySummary = decision.userSummary ?? decision.summary;
  const executed = decision.executedAt != null;
  const dueLabel = decision.followUpAt
    ? format(new Date(decision.followUpAt), 'M월 d일', { locale: ko })
    : null;
  // 수행 완료(회고 대기) vs 후속 확인(시간 도래) 상황별 라벨
  const caption = executed ? '수행 완료' : dueLabel ? `${dueLabel} 예정` : null;
  const captionColor = executed ? colors.text.tertiary : colors.feedback.warning;
  const prompt = executed ? '수행했어요. 결과는 어땠나요?' : '결과가 어땠어요?';

  return (
    <PostIt vary={decision.id} style={styles.card}>
      <View style={[styles.accent, executed && { backgroundColor: colors.feedback.success }]} />
      {caption && <AppText preset="caption" color={captionColor}>{caption}</AppText>}
      <AppText preset="titleMedium">{displaySummary}</AppText>
      <AppText preset="bodySmall" color={colors.text.secondary}>{prompt}</AppText>

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
          onPress={onMemo}
        >
          <AppText preset="bodySmall" color={colors.brand.primary}>메모로 ▸</AppText>
        </Pressable>
      </View>
    </PostIt>
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
