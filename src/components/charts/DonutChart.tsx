import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';

export interface DonutSegment {
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  /** 가운데 큰 값(예: 총 용량) */
  centerValue?: string;
  /** 가운데 보조 라벨 */
  centerLabel?: string;
}

// 순수 SVG 도넛 차트 — strokeDasharray로 세그먼트를 그린다(상단 12시부터 시계방향).
// 값이 모두 0이면 트랙만 표시. 색은 호출부가 @/theme.chart 토큰으로 주입.
export function DonutChart({
  segments, size = 160, strokeWidth = 22, centerValue, centerLabel,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  let acc = 0;
  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        {/* 트랙 */}
        <Circle cx={cx} cy={cy} r={radius} stroke={colors.chart.track} strokeWidth={strokeWidth} fill="none" />
        {/* 세그먼트 (12시 시작 위해 -90° 회전) */}
        <G transform={`rotate(-90 ${cx} ${cy})`}>
          {total > 0 && segments.map((s, i) => {
            const v = Math.max(0, s.value);
            if (v <= 0) return null;
            const dash = (v / total) * circ;
            const offset = -(acc / total) * circ;
            acc += v;
            return (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={s.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>
      {(centerValue || centerLabel) && (
        <View style={styles.center} pointerEvents="none">
          {centerValue && <AppText preset="titleMedium" numberOfLines={1}>{centerValue}</AppText>}
          {centerLabel && <AppText preset="caption" color={colors.text.tertiary}>{centerLabel}</AppText>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: spacing.none,
  },
});
