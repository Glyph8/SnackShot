import { Icon } from '@/components/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, PostIt, Sticker } from '@/components/ui';
import { colors, iconSize, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

interface Props {
  decision: Decision;
  /** 체크 취소 — 다시 진행 중으로 */
  onUncheck(): void;
  /** 결과/회고 기록 — 인라인 편집기(OutcomeEditor) 펼치기 */
  onRecord(): void;
}

/**
 * 수행 완료된 결정 — 의사결정 포스트잇이 여러 번 접혀 작게 보관된 모습(`creased`).
 * 체크 아이콘 = 취소, 본문 탭 = 결과·회고 기록.
 */
export function DecisionDoneRow({ decision, onUncheck, onRecord }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  return (
    <PostIt
      vary={decision.id}
      creased
      peel={false}
      padding={spacing.md}
      containerStyle={styles.outer}
      style={styles.row}
    >
      <Pressable onPress={onUncheck} hitSlop={spacing.sm} accessibilityLabel="체크 취소">
        <Icon name="check-circle" size={iconSize.lg} color={colors.brand.primary} />
      </Pressable>
      <Pressable onPress={onRecord} style={styles.body}>
        <AppText preset="bodyMedium" color={colors.text.onStickyFaint} numberOfLines={1} style={styles.done}>
          {summary}
        </AppText>
      </Pressable>
      {/* 왜 아직 남아있는지 알리는 쪽지 — 누르면 후기 설문지 펼침 */}
      <Pressable onPress={onRecord} hitSlop={spacing.sm} accessibilityLabel="후기 작성">
        <Sticker label="후기 작성 ▸" bg={colors.brand.primary} color={colors.brand.onPrimary} />
      </Pressable>
    </PostIt>
  );
}

const styles = StyleSheet.create({
  outer: { marginTop: spacing.xs, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1 },
  done: { textDecorationLine: 'line-through' },
});
