import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Decision, DecisionCategory } from '@/types/domain';
import type { EditParams } from '@/stores/inbox';

const CATEGORIES: { value: DecisionCategory; label: string }[] = [
  { value: 'investment', label: '투자' },
  { value: 'relationship', label: '관계' },
  { value: 'career', label: '커리어' },
  { value: 'daily', label: '일상' },
  { value: 'other', label: '기타' },
];

interface Props {
  visible: boolean;
  decision: Decision;
  onSave(edits: EditParams): void;
  onCancel(): void;
}

export function EditDecisionSheet({ visible, decision, onSave, onCancel }: Props) {
  const [summary, setSummary] = useState(decision.userSummary ?? decision.summary);
  const [category, setCategory] = useState<DecisionCategory>(
    decision.userCategory ?? decision.category,
  );
  // 남은 일수로 초기화 (없으면 빈 문자열)
  const [daysStr, setDaysStr] = useState(() => {
    if (!decision.followUpAt) return '';
    const remaining = Math.ceil((decision.followUpAt - Date.now()) / 86_400_000);
    return remaining > 0 ? String(remaining) : '';
  });

  function handleSave() {
    const edits: EditParams = {};
    const trimmed = summary.trim();
    if (trimmed) edits.userSummary = trimmed;
    edits.userCategory = category;
    const days = parseInt(daysStr, 10);
    if (!isNaN(days) && days > 0) {
      edits.followUpAt = Date.now() + days * 86_400_000;
    }
    onSave(edits);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={spacing.md}>
            <AppText preset="bodyLarge" color={colors.text.secondary}>취소</AppText>
          </Pressable>
          <AppText preset="titleMedium">결정 수정</AppText>
          <Pressable onPress={handleSave} hitSlop={spacing.md}>
            <AppText preset="button" color={colors.brand.primary}>저장 · 컨펌</AppText>
          </Pressable>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <AppText preset="caption" color={colors.text.secondary} style={styles.label}>요약</AppText>
          <TextInput
            style={styles.textArea}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={3}
            placeholder="결정 내용을 입력하세요"
            placeholderTextColor={colors.text.tertiary}
          />

          <AppText preset="caption" color={colors.text.secondary} style={styles.label}>카테고리</AppText>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => {
              const on = category === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[styles.catBtn, on && styles.catSelected]}
                  onPress={() => setCategory(c.value)}
                >
                  <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>
                    {c.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AppText preset="caption" color={colors.text.secondary} style={styles.label}>후속 확인 (N일 후)</AppText>
          <TextInput
            style={[styles.textArea, styles.inputSm]}
            value={daysStr}
            onChangeText={setDaysStr}
            keyboardType="number-pad"
            placeholder="예: 7"
            placeholderTextColor={colors.text.tertiary}
          />
          <AppText preset="caption" color={colors.text.tertiary} style={styles.hint}>
            비워두면 후속 확인을 설정하지 않습니다.
          </AppText>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.hairline,
  },

  body: { padding: spacing.xl },
  label: { marginBottom: spacing.sm, marginTop: spacing.xl },
  textArea: {
    borderWidth: 1, borderColor: colors.border.card, borderRadius: radius.md,
    padding: spacing.md, fontSize: 15, color: colors.text.primary,
    textAlignVertical: 'top', minHeight: 80,
    backgroundColor: colors.surface.sunken,
  },
  inputSm: { minHeight: 44 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  catSelected: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  hint: { marginTop: spacing.xs },
});
