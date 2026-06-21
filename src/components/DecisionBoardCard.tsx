import { Icon } from '@/components/ui';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Button, LiftPressable, PostIt, StampButton, Tag } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { colors, iconSize, spacing } from '@/theme';
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
 * 왼쪽 원형 체크 = 수행 완료(결과 나중), 본문 탭 = 결정 수정.
 * good/bad는 도장(스탬프) 토글 — 한 번 찍으면 카드가 바로 사라지지 않고 선택 상태로 남아
 * 취소·변경할 수 있고, '확정'을 눌러야 결과가 기록된다.
 */
export function DecisionBoardCard({ decision, entry, onCheck, onResult, onPress, onLongPress }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  const situation = decision.userSituation ?? decision.situation;
  const dueLabel = decision.followUpAt
    ? format(new Date(decision.followUpAt), 'M월 d일', { locale: ko })
    : null;

  // 선택만 한 상태(아직 미기록). 확정 시에만 onResult 호출.
  const [pending, setPending] = useState<'good' | 'bad' | null>(null);
  const choice = pending;
  const select = (r: 'good' | 'bad') => {
    haptics.selection();
    setPending((p) => (p === r ? null : r));
  };

  return (
    <PostIt vary={decision.id} lift containerStyle={styles.cardOuter} style={styles.card}>
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
              <AppText preset="caption" color={colors.text.onStickyFaint}>
                {dueLabel} 예정
              </AppText>
            )}
          </View>

          <AppText preset="cardTitle" color={colors.text.onSticky}>{summary}</AppText>

          {!!situation && (
            <AppText preset="bodySmall" color={colors.text.onStickyMuted} numberOfLines={2}>
              {situation}
            </AppText>
          )}
        </LiftPressable>

        <View style={styles.actions}>
          <StampButton
            label="좋음 👍"
            selected={pending === 'good'}
            color={colors.feedback.success}
            tint={colors.feedback.successTrack}
            onPress={() => select('good')}
          />
          <StampButton
            label="아쉬움 👎"
            selected={pending === 'bad'}
            color={colors.feedback.danger}
            tint={colors.feedback.warningTrack}
            onPress={() => select('bad')}
          />
        </View>

        {choice && (
          <View style={styles.confirmRow}>
            <AppText preset="caption" color={colors.text.onStickyMuted} style={styles.confirmHint}>
              {choice === 'good' ? '좋음' : '아쉬움'}으로 기록할까요?
            </AppText>
            <Pressable onPress={() => setPending(null)} hitSlop={spacing.sm}>
              <AppText preset="caption" color={colors.text.onStickyFaint}>취소</AppText>
            </Pressable>
            <Button
              label="확정"
              variant="stamp"
              size="sm"
              onPress={() => { haptics.success(); onResult(choice); }}
            />
          </View>
        )}
      </View>
    </PostIt>
  );
}

const styles = StyleSheet.create({
  cardOuter: { marginBottom: spacing.md },
  card: {
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
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  confirmHint: { flex: 1 },
});

