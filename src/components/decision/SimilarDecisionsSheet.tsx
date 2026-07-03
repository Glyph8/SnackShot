import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Button, Icon } from '@/components/ui';
import type { DecisionSearchResult } from '@/db';
import { borderWidth, colors, iconSize, radius, spacing } from '@/theme';

// 확정 직후 "비슷한 과거 결정" 선택 시트 (D4-b).
// 자동 저장 금지 — 사용자가 고른 것만 link_type='similar'로 저장한다(노이즈 방지).

interface Props {
  candidates: DecisionSearchResult[];
  onSave(selectedIds: string[]): void;
  onClose(): void;
}

export function SimilarDecisionsSheet({ candidates, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <AppText preset="titleMedium">비슷한 과거 결정</AppText>
          <AppText preset="caption" color={colors.text.secondary}>
            연결해두면 나중에 함께 돌아볼 수 있어요. 선택하지 않아도 됩니다.
          </AppText>

          <View style={styles.list}>
            {candidates.map((c) => {
              const on = selected.includes(c.decision.id);
              const summary = c.decision.userSummary ?? c.decision.summary;
              return (
                <Pressable
                  key={c.decision.id}
                  style={[styles.row, on && styles.rowOn]}
                  onPress={() => toggle(c.decision.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on && <Icon name="check" size={iconSize.sm} color={colors.brand.onPrimary} />}
                  </View>
                  <View style={styles.rowText}>
                    <AppText preset="bodyMedium" numberOfLines={2}>{summary}</AppText>
                    <AppText preset="caption" color={colors.text.tertiary}>
                      {decisionCategoryLabel(c.decision)}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button label="건너뛰기" variant="quiet" size="sm" onPress={onClose} />
            <Button
              label="연결"
              size="sm"
              disabled={selected.length === 0}
              onPress={() => onSave(selected)}
              style={styles.flex1}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.surface.overlayScrim, justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.surface.paperRaised, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
  },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.card, backgroundColor: colors.surface.paper,
  },
  rowOn: { borderColor: colors.brand.primary },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: borderWidth.thick, borderColor: colors.border.card,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  rowText: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  flex1: { flex: 1 },
});
