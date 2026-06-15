import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

interface Props {
  /** 0–100 신뢰도 */
  value: number;
  /** 우측 % 수치 표시 (기본 true) */
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 신뢰도 임계값 → 색 (high ≥85, medium ≥60, low) */
export function confidenceColor(value: number): string {
  if (value >= 85) return colors.confidence.high;
  if (value >= 60) return colors.confidence.medium;
  return colors.confidence.low;
}

/** 결정 추출 확신도 막대. 색 + 수치 이중 표기. */
export function ConfidenceBar({ value, showLabel = true, style }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const tint = confidenceColor(clamped);
  return (
    <View style={[styles.row, style]}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: tint }]} />
      </View>
      {showLabel && (
        <AppText preset="caption" color={tint}>
          {`${Math.round(clamped)}%`}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: {
    flex: 1,
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.confidence.track,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
