import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import type { ModelOption } from '@/lib/env';
import { colors, radius, spacing } from '@/theme';

// settings.tsx에서 분리 (P3). API 키 입력 + 모델 선택 행 — 순수 프레젠테이션.

export interface KeyInputRowProps {
  label: string;
  isSet: boolean;
  value: string;
  onChangeText(v: string): void;
  onSave(): void;
  onDelete(): void;
  models: ModelOption[];
  selectedModel: string;
  onSelectModel(m: string): void;
}

export function KeyInputRow({
  label, isSet, value, onChangeText, onSave, onDelete,
  models, selectedModel, onSelectModel,
}: KeyInputRowProps) {
  return (
    <View style={styles.keyRow}>
      <AppText preset="bodyLarge">{label}</AppText>
      {isSet ? (
        <View style={styles.keySetRow}>
          <AppText preset="caption" color={colors.text.tertiary}>●●●●●●●● 저장됨</AppText>
          <Button label="삭제" variant="secondary" size="sm" onPress={onDelete} />
        </View>
      ) : (
        <View style={styles.keyInputRow}>
          <TextInput
            style={styles.keyInput}
            value={value}
            onChangeText={onChangeText}
            placeholder="sk-... 또는 AI... 입력"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button label="저장" onPress={onSave} disabled={!value.trim()} size="sm" />
        </View>
      )}

      {/* 모델 선택 */}
      <AppText preset="caption" color={colors.text.secondary} style={styles.modelLabel}>모델</AppText>
      <View style={styles.modelRow}>
        {models.map((m) => {
          const on = m.value === selectedModel;
          return (
            <Pressable
              key={m.value}
              onPress={() => onSelectModel(m.value)}
              style={[styles.modelChip, on && styles.modelChipOn]}
            >
              <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyRow: { gap: spacing.sm },
  modelLabel: { marginTop: spacing.xs },
  modelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modelChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  modelChipOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  keySetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keyInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  keyInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border.card, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 13, color: colors.text.primary,
    backgroundColor: colors.surface.paperRaised,
  },
});
