import { StyleSheet, View } from 'react-native';
import Svg, { G, Line, Polygon, Polyline } from 'react-native-svg';

import { AppText } from '@/components/ui';
import type { DailyCandle } from '@/services/quotes/types';
import { colors, spacing } from '@/theme';

// I3(d)1: 90일 일봉 종가 라인 + 결정 마커(▲ buy / ▼ sell / ◇ deliberating).
//   마커 자체 탭은 미채택(터치 정확도 — 확정): 시각화 전용, 내비게이션은 아래 리스트가 담당.
//   svg는 DailyQuotesPanel의 Polyline 선례 재사용.

const CHART_W = 320;
const CHART_H = 130;
const PAD = 10;

export type MarkerKind = 'buy' | 'sell' | 'deliberating';
export interface ChartMarker {
  index: number;      // candles 배열 인덱스(휴장일은 다음 거래일로 스냅한 값)
  kind: MarkerKind;
  dotted?: boolean;   // deliberating이고 decide_by가 미래 → 우측 가장자리 점선
}

const KIND_COLOR: Record<MarkerKind, string> = {
  buy: colors.feedback.success,
  sell: colors.feedback.danger,
  deliberating: colors.brand.primary,
};

function markerPoints(kind: MarkerKind, x: number, y: number): string {
  const s = 5;
  if (kind === 'buy') return `${x},${y - s} ${x - s},${y + s} ${x + s},${y + s}`;
  if (kind === 'sell') return `${x},${y + s} ${x - s},${y - s} ${x + s},${y - s}`;
  return `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`; // diamond
}

export function StockDecisionChart({ candles, markers }: { candles: DailyCandle[]; markers: ChartMarker[] }) {
  if (candles.length === 0) return null;

  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const stepX = candles.length > 1 ? CHART_W / (candles.length - 1) : 0;
  const xy = (i: number, close: number): [number, number] => [
    i * stepX,
    CHART_H - PAD - ((close - min) / range) * (CHART_H - PAD * 2),
  ];
  const linePts = candles.map((c, i) => xy(i, c.close).join(',')).join(' ');

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
        <Polyline points={linePts} fill="none" stroke={colors.chart.c1} strokeWidth={2} />
        {markers.map((m, k) => {
          const idx = Math.min(Math.max(m.index, 0), candles.length - 1);
          const [x, y] = m.dotted ? [CHART_W, CHART_H / 2] : xy(idx, candles[idx].close);
          return (
            <G key={`m-${k}`}>
              {m.dotted && (
                <Line x1={x} y1={PAD} x2={x} y2={CHART_H - PAD} stroke={KIND_COLOR[m.kind]} strokeWidth={1} strokeDasharray="3,3" />
              )}
              <Polygon points={markerPoints(m.kind, x, y)} fill={KIND_COLOR[m.kind]} />
            </G>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <Legend color={KIND_COLOR.buy} label="▲ 매수" />
        <Legend color={KIND_COLOR.sell} label="▼ 매도" />
        <Legend color={KIND_COLOR.deliberating} label="◇ 미결" />
      </View>
      <AppText preset="caption" color={colors.text.tertiary}>최근 90일 종가 · 전 영업일까지 (T+1)</AppText>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <AppText preset="caption" color={color}>{label}</AppText>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  legend: { flexDirection: 'row', gap: spacing.md },
});
