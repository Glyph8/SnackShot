import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Button } from '@/components/ui';
import type { SimilarPastItem } from '@/db';
import type { OutcomeResult } from '@/types/domain';
import { borderWidth, colors, radius, spacing } from '@/theme';

// F1: 확정 전 유사 과거 결정 — 열람 전용 바텀시트 + 요약 배지.
// 확정 직후 뜨는 SimilarDecisionsSheet(링크 저장)와 역할 분리: 여기선 저장/링크 없이 참고만 한다.

// 배지 요약에 쓰는 결과 이모지. unclear/skipped는 이모지 없이 카운트에서 제외.
const RESULT_EMOJI: Partial<Record<OutcomeResult, string>> = {
  good: '👍',
  bad: '👎',
  mixed: '🤔',
};

// 상세 시트의 결과 라벨(이모지 포함).
const RESULT_LABEL: Record<OutcomeResult, string> = {
  good: '좋았음 👍',
  bad: '아쉬움 👎',
  mixed: '반반 🤔',
  unclear: '기억 안 남',
  skipped: '건너뜀',
};

function emojiSummary(items: SimilarPastItem[]): string {
  const counts: Partial<Record<OutcomeResult, number>> = {};
  for (const it of items) {
    if (it.result && RESULT_EMOJI[it.result]) {
      counts[it.result] = (counts[it.result] ?? 0) + 1;
    }
  }
  return (Object.keys(RESULT_EMOJI) as OutcomeResult[])
    .filter((k) => counts[k])
    .map((k) => `${RESULT_EMOJI[k]}${counts[k]}`)
    .join(' ');
}

export function SimilarPastBadge({
  items,
  onPress,
}: {
  items: SimilarPastItem[];
  onPress(): void;
}) {
  if (items.length === 0) return null;
  const summary = emojiSummary(items);
  return (
    <Pressable
      onPress={onPress}
      style={styles.badge}
      accessibilityRole="button"
      accessibilityLabel={`비슷한 과거 결정 ${items.length}건 보기`}
    >
      <AppText preset="caption" color={colors.text.secondary}>
        {`비슷한 과거 결정 ${items.length}건${summary ? ` · ${summary}` : ''}`}
      </AppText>
    </Pressable>
  );
}

export function PastDecisionsSheet({
  items,
  onClose,
}: {
  items: SimilarPastItem[];
  onClose(): void;
}) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <AppText preset="titleMedium">비슷한 과거 결정</AppText>
          <AppText preset="caption" color={colors.text.secondary}>
            지금 결정을 확정하기 전에 참고하세요. 여기서는 열람만 합니다.
          </AppText>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
            {items.map((it) => {
              const summary = it.decision.userSummary ?? it.decision.summary;
              return (
                <View key={it.decision.id} style={styles.row}>
                  <View style={styles.rowHead}>
                    <AppText preset="caption" color={colors.text.tertiary}>
                      {decisionCategoryLabel(it.decision)}
                    </AppText>
                    {it.result && (
                      <AppText preset="caption" color={colors.text.secondary}>
                        {RESULT_LABEL[it.result]}
                      </AppText>
                    )}
                  </View>
                  <AppText preset="bodyMedium" numberOfLines={3}>{summary}</AppText>
                  {it.learnings ? (
                    <AppText preset="caption" color={colors.text.secondary}>
                      {`교훈: ${it.learnings}`}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Button label="닫기" size="sm" onPress={onClose} style={styles.flex1} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: colors.border.card,
    backgroundColor: colors.surface.sunken,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.surface.overlayScrim,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  scroll: { marginTop: spacing.sm },
  list: { gap: spacing.sm },
  row: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  flex1: { flex: 1 },
});
