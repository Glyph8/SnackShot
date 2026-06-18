import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS } from '@/components/DecisionCardBody';
import { AppText, Card, Tag } from '@/components/ui';
import { colors, iconSize, spacing } from '@/theme';
import type { Decision, Entry } from '@/types/domain';

interface Props {
  decision: Decision;
  entry?: Entry;
  /** 수행 완료 체크 — executed_at 기록 후 보드에서 제거 */
  onCheck(): void;
  /** 카드 본문 탭 — 결정 상세(클립)로 이동 */
  onPress(): void;
}

/**
 * 결정 보드(todo) 카드 (v8 Phase 2).
 * 왼쪽 원형 체크 = 수행 완료, 본문 탭 = 상세. 결과(good/bad) 기록은 Phase 4에서 추가.
 */
export function DecisionBoardCard({ decision, entry, onCheck, onPress }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  const situation = decision.userSituation ?? decision.situation;
  const category = decision.userCategory ?? decision.category;
  const dueLabel = decision.followUpAt
    ? format(new Date(decision.followUpAt), 'M월 d일', { locale: ko })
    : null;

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={onCheck}
        hitSlop={spacing.sm}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityLabel="수행 완료"
      >
        <Ionicons name="ellipse-outline" size={iconSize.lg} color={colors.brand.primary} />
      </Pressable>

      <Pressable onPress={onPress} style={styles.body}>
        <View style={styles.topRow}>
          <Tag label={CATEGORY_LABELS[category] ?? category} />
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
      </Pressable>
    </Card>
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
  body: { flex: 1, gap: spacing.xs },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
