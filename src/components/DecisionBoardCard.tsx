import { Icon } from '@/components/ui';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, LiftPressable, PostIt, Tag } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';
import type { Decision, Entry } from '@/types/domain';

interface Props {
  decision: Decision;
  entry?: Entry;
  /** 수행 완료 체크(결과 없이) — executed_at 기록 후 회고 대기로 이동 */
  onCheck(): void;
  /** good/bad 원탭 — 수행 완료 + 결과 기록까지 한 번에 마무리 */
  onResult(result: 'good' | 'bad'): void;
  /** 카드 본문 탭 — 결정 수정 시트 열기 */
  onPress(): void;
  /** 본문 롱프레스 — 빠른 액션 시트(수정·완료·취소) 열기 */
  onLongPress?(): void;
}

/**
 * 결정 보드(todo) 카드 (v8 Phase 2/4).
 * 왼쪽 원형 체크 = 수행 완료(결과 나중), good/bad = 즉시 마무리, 본문 탭 = 결정 수정.
 */
export function DecisionBoardCard({ decision, entry, onCheck, onResult, onPress, onLongPress }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  const situation = decision.userSituation ?? decision.situation;
  const dueLabel = decision.followUpAt
    ? format(new Date(decision.followUpAt), 'M월 d일', { locale: ko })
    : null;

  return (
    <PostIt vary={decision.id} style={styles.card}>
      <Pressable
        onPress={onCheck}
        hitSlop={spacing.sm}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityLabel="수행 완료"
      >
        <Icon name="radio-off" size={iconSize.lg} color={colors.brand.primary} />
      </Pressable>

      <View style={styles.rightCol}>
        <LiftPressable onPress={onPress} onLongPress={onLongPress} style={styles.body}>
          <View style={styles.topRow}>
            <Tag label={decisionCategoryLabel(decision)} />
            {dueLabel && (
              <AppText preset="caption" color={colors.text.tertiary}>
                {dueLabel} 예정
              </AppText>
            )}
          </View>

          <AppText preset="cardTitle">{summary}</AppText>

          {!!situation && (
            <AppText preset="bodySmall" color={colors.text.secondary} numberOfLines={2}>
              {situation}
            </AppText>
          )}
        </LiftPressable>

        <View style={styles.actions}>
          <Pressable
            style={[styles.resultBtn, { backgroundColor: colors.feedback.successTrack }]}
            onPress={() => onResult('good')}
          >
            <AppText preset="bodySmall" color={colors.feedback.success}>좋음 👍</AppText>
          </Pressable>
          <Pressable
            style={[styles.resultBtn, { backgroundColor: colors.feedback.warningTrack }]}
            onPress={() => onResult('bad')}
          >
            <AppText preset="bodySmall" color={colors.feedback.danger}>아쉬움 👎</AppText>
          </Pressable>
        </View>
      </View>
    </PostIt>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  check: { paddingTop: spacing.xs },
  rightCol: { flex: 1, gap: spacing.md },
  body: { gap: spacing.xs },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  resultBtn: {
    flex: 1, paddingVertical: spacing.sm,
    borderRadius: radius.sm, alignItems: 'center',
  },
});

