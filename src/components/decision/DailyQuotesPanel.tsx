import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { ActionSheet, type ActionItem, AppText, CollapsibleSection } from '@/components/ui';
import { getQuoteService } from '@/services/quotes';
import type { DailyCandle } from '@/services/quotes/types';
import { colors, radius, spacing } from '@/theme';

// H5d: 최근 30영업일 종가 라인차트 + 일봉 리스트 + 행 탭 원탭 기입(진입/목표/손절).
// 캐시하지 않음(열 때마다 1콜, 확정). 시세 키·ticker 있을 때만 노출. T+1 고지.

const DAYS = 30;
const CHART_W = 320;
const CHART_H = 90;

export type PriceField = 'entryPrice' | 'targetPrice' | 'stopPrice';

interface Props {
  ticker: string;
  keyAvailable: boolean;
  onPickPrice(field: PriceField, price: number): void;
}

function num(n: number): string {
  return n.toLocaleString('ko-KR');
}
function fmtDate(d: string): string {
  return d.length === 8 ? `${d.slice(4, 6)}.${d.slice(6, 8)}` : d;
}

export function DailyQuotesPanel({ ticker, keyAvailable, onPickPrice }: Props) {
  if (!ticker.trim() || !keyAvailable) return null;
  return (
    <CollapsibleSection title="최근 시세 보기" hint="일봉 · T+1">
      <QuotesContent ticker={ticker.trim()} onPickPrice={onPickPrice} />
    </CollapsibleSection>
  );
}

// 열릴 때(children 마운트)만 조회 — CollapsibleSection이 lazy 마운트.
function QuotesContent({ ticker, onPickPrice }: { ticker: string; onPickPrice: Props['onPickPrice'] }) {
  const [candles, setCandles] = useState<DailyCandle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<DailyCandle | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await getQuoteService().getDailyCandles(ticker, DAYS);
        if (alive) setCandles(c);
      } catch {
        if (alive) setCandles([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ticker]);

  if (loading) return <ActivityIndicator color={colors.brand.primary} style={styles.loader} />;
  if (!candles || candles.length === 0) {
    return <AppText preset="caption" color={colors.text.tertiary}>시세를 불러올 수 없어요.</AppText>;
  }

  // 종가 min-max 정규화 라인(가격은 baseline 0이 아니라 min~max로 스케일).
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const stepX = candles.length > 1 ? CHART_W / (candles.length - 1) : 0;
  const pts = candles
    .map((c, i) => `${(i * stepX).toFixed(1)},${(CHART_H - ((c.close - min) / range) * (CHART_H - 8) - 4).toFixed(1)}`)
    .join(' ');

  const actions: ActionItem[] = pick ? [
    { label: `진입가로 넣기 (${num(pick.close)})`, icon: 'check', onPress: () => { onPickPrice('entryPrice', pick.close); setPick(null); } },
    { label: `목표가로 넣기 (${num(pick.close)})`, icon: 'check', onPress: () => { onPickPrice('targetPrice', pick.close); setPick(null); } },
    { label: `손절가로 넣기 (${num(pick.close)})`, icon: 'check', onPress: () => { onPickPrice('stopPrice', pick.close); setPick(null); } },
  ] : [];

  // 리스트는 최근이 위로
  const recent = [...candles].reverse();

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
        <Polyline points={pts} fill="none" stroke={colors.chart.c1} strokeWidth={2} />
      </Svg>

      <View style={styles.list}>
        {recent.map((c) => (
          <Pressable key={c.date} style={styles.row} onPress={() => setPick(c)}>
            <AppText preset="caption" color={colors.text.secondary} style={styles.dateCol}>{fmtDate(c.date)}</AppText>
            <AppText preset="caption" color={colors.text.tertiary} style={styles.col}>{`시 ${num(c.open)}`}</AppText>
            <AppText preset="bodySmall" color={colors.text.primary} style={styles.col}>{`종 ${num(c.close)}`}</AppText>
          </Pressable>
        ))}
      </View>

      <AppText preset="caption" color={colors.text.tertiary}>전 영업일까지의 일봉입니다 (T+1)</AppText>

      <ActionSheet visible={!!pick} onClose={() => setPick(null)} items={actions} title="이 종가를 어디에 넣을까요?" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  loader: { marginVertical: spacing.lg },
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  dateCol: { width: 56 },
  col: { flex: 1, textAlign: 'right' },
});
