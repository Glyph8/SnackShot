import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { borderWidth, colors, radius, spacing } from '@/theme';

// F3: 본인 확신도 입력 칩(공용) — EditDecisionSheet·compose-decision 공유.
// 값은 0~1 REAL(user_confidence 컬럼과 동일). 선택된 칩을 다시 누르면 해제(null).

const LEVELS = [50, 60, 70, 80, 90] as const;

interface Props {
  /** 0~1 또는 null(미입력) */
  value: number | null;
  onChange(v: number | null): void;
}

export function ConfidenceChips({ value, onChange }: Props) {
  const pct = value != null ? Math.round(value * 100) : null;
  return (
    <View style={styles.row}>
      {LEVELS.map((lv) => {
        const on = pct === lv;
        return (
          <Pressable
            key={lv}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(on ? null : lv / 100)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`확신도 ${lv}%`}
          >
            <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>
              {`${lv}%`}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  chipOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
});
