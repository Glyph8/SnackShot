import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export interface LegendItem {
  color: string;
  label: string;
  /** 우측에 표시할 값(용량·개수 등) */
  value?: string;
  /** 비중 % (0~100) — 있으면 라벨 옆에 표시 */
  percent?: number;
}

// 차트 범례 — 색 스와치 + 라벨 + (비중%) + 값. 시인성을 위해 차트와 같은 색을 쓴다.
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <View style={styles.wrap}>
      {items.map((it, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: it.color }]} />
          <AppText preset="bodySmall" style={styles.label} numberOfLines={1}>{it.label}</AppText>
          {it.percent != null && (
            <AppText preset="caption" color={colors.text.tertiary} style={styles.pct}>{Math.round(it.percent)}%</AppText>
          )}
          {it.value != null && (
            <AppText preset="bodySmall" color={colors.text.secondary} style={styles.value}>{it.value}</AppText>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: radius.sm },
  label: { flexShrink: 1 },
  pct: { width: 38, textAlign: 'right' },
  value: { marginLeft: 'auto' },
});
