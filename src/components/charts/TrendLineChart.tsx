import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';

export interface TrendPoint {
  label: string;
  value: number;
}

interface Props {
  points: TrendPoint[]; // 왼→오 (오래된→최신)
  height?: number;
  formatValue?: (v: number) => string;
}

// 순수 SVG 영역+라인 차트 — 월별 추세 등. 막대 외 시각화.
export function TrendLineChart({ points, height = 120, formatValue }: Props) {
  if (points.length === 0) {
    return <AppText preset="bodySmall" color={colors.text.tertiary}>데이터 없음</AppText>;
  }

  const W = 320;          // viewBox 기준 폭(컨테이너에 맞춰 100%로 늘어남)
  const H = height;
  const padTop = 8;
  const padBottom = 8;
  const usableH = H - padTop - padBottom;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const stepX = n > 1 ? W / (n - 1) : 0;

  const xy = points.map((p, i) => {
    const x = n > 1 ? i * stepX : W / 2;
    const y = padTop + usableH * (1 - p.value / max);
    return { x, y };
  });

  const linePts = xy.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPath = `M ${xy[0].x},${H - padBottom} ` +
    xy.map((c) => `L ${c.x},${c.y}`).join(' ') +
    ` L ${xy[n - 1].x},${H - padBottom} Z`;

  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.chart.c1} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.chart.c1} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#trendFill)" />
        <Polyline points={linePts} fill="none" stroke={colors.chart.c1} strokeWidth={2} />
      </Svg>
      <View style={styles.labels}>
        {points.map((p, i) => (
          <AppText
            key={i}
            preset="caption"
            color={p.label === peak.label ? colors.text.secondary : colors.text.tertiary}
            style={styles.label}
            numberOfLines={1}
          >
            {p.label}
          </AppText>
        ))}
      </View>
      {formatValue && (
        <AppText preset="caption" color={colors.text.tertiary} style={styles.peak}>
          최대 {peak.label} · {formatValue(peak.value)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  label: { flex: 1, textAlign: 'center' },
  peak: { marginTop: spacing.xs },
});
