import { StyleSheet, View } from 'react-native';

import { ChartLegend, type LegendItem } from '@/components/charts/ChartLegend';
import { DonutChart, type DonutSegment } from '@/components/charts/DonutChart';
import { AppText } from '@/components/ui';
import type { DecisionPerformance } from '@/db';
import { colors, spacing } from '@/theme';

// 결정 리뷰 대시보드 본문 (D4-a) — 순수 프레젠테이션. 데이터는 부모가 주입.
// 집계: byCategory(결과 분포) · calibration(확신도별 good율) · executionLagDays.

const RESULT_META: { key: 'good' | 'bad' | 'mixed' | 'unclear' | 'skipped'; label: string; color: string }[] = [
  { key: 'good', label: '좋았음', color: colors.feedback.success },
  { key: 'bad', label: '아쉬움', color: colors.feedback.danger },
  { key: 'mixed', label: '반반', color: colors.feedback.warning },
  { key: 'unclear', label: '불명확', color: colors.chart.c5 },
  { key: 'skipped', label: '건너뜀', color: colors.chart.c6 },
];

const CATEGORY_KO: Record<string, string> = {
  investment: '투자', relationship: '관계', career: '커리어', daily: '일상', other: '기타',
};

export function DecisionStats({ performance }: { performance: DecisionPerformance }) {
  const { byCategory, calibration, executionLagDays } = performance;

  // 결과 총합(도넛) — 전 카테고리 result 분포를 합산.
  const totals = { good: 0, bad: 0, mixed: 0, unclear: 0, skipped: 0 };
  for (const c of byCategory) {
    totals.good += c.good; totals.bad += c.bad; totals.mixed += c.mixed;
    totals.unclear += c.unclear; totals.skipped += c.skipped;
  }
  const grand = totals.good + totals.bad + totals.mixed + totals.unclear + totals.skipped;

  if (grand === 0) {
    return (
      <View style={styles.empty}>
        <AppText preset="bodyMedium" color={colors.text.tertiary}>
          회고를 기록하면 결과·확신도 통계가 쌓여요.
        </AppText>
      </View>
    );
  }

  const segments: DonutSegment[] = RESULT_META
    .map((m) => ({ value: totals[m.key], color: m.color }))
    .filter((s) => s.value > 0);
  const legend: LegendItem[] = RESULT_META
    .filter((m) => totals[m.key] > 0)
    .map((m) => ({
      color: m.color,
      label: m.label,
      value: String(totals[m.key]),
      percent: (totals[m.key] / grand) * 100,
    }));

  return (
    <View style={styles.wrap}>
      {/* 결과 분포 */}
      <View style={styles.donutRow}>
        <DonutChart segments={segments} size={128} strokeWidth={18} centerValue={String(grand)} centerLabel="회고" />
        <ChartLegend items={legend} />
      </View>

      {/* 카테고리별 */}
      {byCategory.length > 0 && (
        <View style={styles.section}>
          <AppText preset="caption" color={colors.text.secondary}>카테고리별</AppText>
          {byCategory.map((c) => (
            <View key={c.label} style={styles.catRow}>
              <AppText preset="bodyMedium" style={styles.catLabel} numberOfLines={1}>
                {CATEGORY_KO[c.label] ?? c.label}
              </AppText>
              <AppText preset="caption" color={colors.text.secondary}>
                {`좋음 ${c.good} · 아쉬움 ${c.bad} · 반반 ${c.mixed} · 계 ${c.total}`}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {/* 확신도 보정 */}
      <View style={styles.section}>
        <AppText preset="caption" color={colors.text.secondary}>확신도 대비 실제 좋음율</AppText>
        <AppText preset="caption" color={colors.text.tertiary}>본인 입력 확신도 우선, 없으면 AI 추출 확신도</AppText>
        {calibration.map((b) => (
          <View key={b.bucket} style={styles.catRow}>
            <AppText preset="bodyMedium" style={styles.catLabel}>{b.bucket}</AppText>
            <AppText preset="caption" color={colors.text.secondary}>
              {b.goodRate == null
                ? '표본 없음'
                : `${Math.round(b.goodRate * 100)}% (n=${b.sample})${b.lowSample ? ' · 표본 적음' : ''}`}
            </AppText>
          </View>
        ))}
      </View>

      {/* 실행 지연 */}
      <View style={styles.catRow}>
        <AppText preset="bodyMedium" style={styles.catLabel}>실행까지 걸린 시간(중앙값)</AppText>
        <AppText preset="caption" color={colors.text.secondary}>
          {executionLagDays == null ? '데이터 없음' : `${executionLagDays}일`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  empty: { paddingVertical: spacing.lg },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  section: { gap: spacing.xs },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  catLabel: { flexShrink: 1 },
});
