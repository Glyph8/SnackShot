import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Decision, OutcomeResult } from '@/types/domain';

// 결과 기록 인라인 편집기 (v8 Phase 4.1) — 모달 대신 결정 카드 아래에서 펼쳐진다.
// good/bad만이 아니라 텍스트 회고도 바로 입력. 후속 확인·완료(체크행) 양쪽에서 재사용.

const RESULTS: { value: OutcomeResult; label: string }[] = [
  { value: 'good', label: '좋았음 👍' },
  { value: 'bad', label: '아쉬움 👎' },
  { value: 'mixed', label: '반반 🤔' },
  { value: 'unclear', label: '기억 안 남' },
];

interface Props {
  decision: Decision;
  onSubmit(result: OutcomeResult, reflection?: string): void;
  /** 영상으로 회고 기록 (record 화면으로) */
  onVideo(): void;
  /** 접기 */
  onCancel(): void;
}

export function OutcomeEditor({ onSubmit, onVideo, onCancel }: Props) {
  const [result, setResult] = useState<OutcomeResult | null>(null);
  const [reflection, setReflection] = useState('');

  return (
    <Card raised style={styles.card}>
      <AppText preset="caption" color={colors.text.secondary}>결과</AppText>
      <View style={styles.resultRow}>
        {RESULTS.map((r) => {
          const on = result === r.value;
          return (
            <Pressable key={r.value} style={[styles.chip, on && styles.chipOn]} onPress={() => setResult(r.value)}>
              <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>{r.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        value={reflection}
        onChangeText={setReflection}
        placeholder="회고·배운 점 (선택)"
        placeholderTextColor={colors.text.tertiary}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.actions}>
        <Button label="취소" variant="quiet" size="sm" onPress={onCancel} />
        <Button label="영상으로 ▸" variant="secondary" size="sm" onPress={onVideo} />
        <Button
          label="저장"
          variant="primary"
          size="sm"
          disabled={!result}
          onPress={() => result && onSubmit(result, reflection)}
          style={styles.flex1}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  resultRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  chipOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  input: {
    borderWidth: 1, borderColor: colors.border.card, borderRadius: radius.md,
    padding: spacing.md, fontSize: 15, color: colors.text.primary,
    minHeight: 72, textAlignVertical: 'top', backgroundColor: colors.surface.sunken,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex1: { flex: 1 },
});
