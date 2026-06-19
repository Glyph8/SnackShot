import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS } from '@/components/DecisionCardBody';
import { ChartLegend, type LegendItem } from '@/components/charts/ChartLegend';
import { DonutChart, type DonutSegment } from '@/components/charts/DonutChart';
import { TrendLineChart, type TrendPoint } from '@/components/charts/TrendLineChart';
import { AppText } from '@/components/ui';
import { getAllMediaEntries, getEntryStats, type EntryStats } from '@/db';
import { entryOriginalBytes, getEntriesStorageBytes, getStorageBreakdown, type StorageBreakdown } from '@/lib/storage';
import { colors, radius, spacing } from '@/theme';
import type { Entry } from '@/types/domain';

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)}GB`;
  if (b >= 1_048_576) return `${Math.round(b / 1_048_576)}MB`;
  if (b >= 1024) return `${Math.round(b / 1024)}KB`;
  return `${b}B`;
}

const MONTH_LABEL = (m: string) => `${Number(m.slice(5, 7))}월`;
const pctOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

interface Dist {
  byLevel: number[];                       // [L0,L1,L2,L3] — 영상(voice/silent)만 집계
  backup: { none: number; backed: number; purged: number };
  reclaimable: number;                     // 백업됐고 원본 보유 → 정리 시 확보 가능 바이트
  mediaCount: number;                      // 전체 미디어(영상+녹음)
  videoCount: number;                      // 영상만 — 압축 단계 분포 분모
  audioCount: number;                      // 녹음 — 압축 비대상(별도 표기)
}

// 압축 단계 분포는 "영상만" 집계한다(녹음은 Video 압축 대상이 아니므로 항상 원본).
// 백업/정리 가능은 녹음 포함(녹음도 백업 대상).
function computeDist(entries: Entry[]): Dist {
  const byLevel = [0, 0, 0, 0];
  const backup = { none: 0, backed: 0, purged: 0 };
  let reclaimable = 0;
  let videoCount = 0;
  let audioCount = 0;
  for (const e of entries) {
    if (e.mode === 'voice' || e.mode === 'silent') {
      videoCount += 1;
      byLevel[Math.min(3, e.compressionLevel ?? 0)] += 1;
    } else {
      audioCount += 1; // audio
    }
    if (e.originalPurgedAt != null) backup.purged += 1;
    else if (e.originalBackedUpAt != null) { backup.backed += 1; reclaimable += entryOriginalBytes(e); }
    else backup.none += 1;
  }
  return { byLevel, backup, reclaimable, mediaCount: entries.length, videoCount, audioCount };
}

export function SettingsStats() {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<EntryStats | null>(null);
  const [bytes, setBytes] = useState(0);
  const [storage, setStorage] = useState<StorageBreakdown | null>(null);
  const [dist, setDist] = useState<Dist | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const s = await getEntryStats(db);
          const media = await getAllMediaEntries(db);
          const b = getEntriesStorageBytes();
          const sb = getStorageBreakdown(media);
          const d = computeDist(media);
          if (mounted) { setStats(s); setBytes(b); setStorage(sb); setDist(d); }
        } catch (e) {
          console.error('[stats] load failed', e);
        }
      })();
      return () => { mounted = false; };
    }, [db]),
  );

  if (!stats || !dist) return <ActivityIndicator color={colors.brand.primary} style={styles.loader} />;

  const backupCoverage = pctOf(dist.backup.backed + dist.backup.purged, dist.mediaCount);
  const orphan = storage ? Math.max(0, bytes - storage.entriesTotal) : 0;

  // 색 배정 (시인성: 항목별 다른 색)
  const kindSegs: DonutSegment[] = storage ? [
    { value: storage.byKind.original, color: colors.chart.c1 },
    { value: storage.byKind.compressed, color: colors.chart.c2 },
    { value: storage.byKind.thumbnail, color: colors.chart.c4 },
    { value: orphan, color: colors.chart.c6 },
  ] : [];
  const kindLegend: LegendItem[] = storage ? [
    { color: colors.chart.c1, label: '원본', value: fmtBytes(storage.byKind.original), percent: pctOf(storage.byKind.original, bytes) },
    { color: colors.chart.c2, label: '압축본', value: fmtBytes(storage.byKind.compressed), percent: pctOf(storage.byKind.compressed, bytes) },
    { color: colors.chart.c4, label: '썸네일', value: fmtBytes(storage.byKind.thumbnail), percent: pctOf(storage.byKind.thumbnail, bytes) },
    ...(orphan > 0 ? [{ color: colors.chart.c6, label: '미사용', value: fmtBytes(orphan), percent: pctOf(orphan, bytes) }] : []),
  ] : [];

  const levelColors = [colors.chart.c6, colors.chart.c1, colors.chart.c3, colors.chart.c2];
  const levelSegs: DonutSegment[] = dist.byLevel.map((c, i) => ({ value: c, color: levelColors[i] }));
  const levelLegend: LegendItem[] = dist.byLevel.map((c, i) => ({
    color: levelColors[i], label: ['원본(L0)', 'L1', 'L2', 'L3'][i], value: `${c}개`, percent: pctOf(c, dist.videoCount),
  }));

  const backupSegs = [
    { value: dist.backup.none, color: colors.chart.c6 },
    { value: dist.backup.backed, color: colors.chart.c2 },
    { value: dist.backup.purged, color: colors.chart.c5 },
  ];
  const backupLegend: LegendItem[] = [
    { color: colors.chart.c6, label: '미백업', value: `${dist.backup.none}개` },
    { color: colors.chart.c2, label: '백업됨', value: `${dist.backup.backed}개` },
    { color: colors.chart.c5, label: '원본 정리됨', value: `${dist.backup.purged}개` },
  ];

  const months: TrendPoint[] = storage
    ? [...storage.byMonth].slice(0, 6).reverse().map((m) => ({ label: MONTH_LABEL(m.month), value: m.bytes }))
    : [];

  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.count));
  const catColors = [colors.chart.c1, colors.chart.c2, colors.chart.c3, colors.chart.c4, colors.chart.c5, colors.chart.c6];

  return (
    <View style={styles.wrap}>
      {/* 색상 강조 지표 타일 */}
      <View style={styles.grid}>
        <StatTile label="총 클립" value={String(stats.totalClips)} accent={colors.chart.c1} />
        <StatTile label="총 분량" value={fmtDuration(stats.totalDurationMs)} accent={colors.chart.c4} />
        <StatTile label="저장 용량" value={fmtBytes(bytes)} accent={colors.chart.c3} />
        <StatTile label="정리 가능" value={fmtBytes(dist.reclaimable)} sub="백업된 원본" accent={colors.chart.c2} />
        <StatTile label="백업 커버리지" value={`${Math.round(backupCoverage)}%`} sub={`${dist.mediaCount}개 중`} accent={colors.chart.c5} />
        <StatTile label="확정 결정" value={String(stats.decisionsConfirmed)} sub={`대기 ${stats.decisionsPending}`} accent={colors.chart.c6} />
      </View>

      {/* 저장 용량 — 종류별 도넛 */}
      {storage && bytes > 0 && (
        <View style={styles.section}>
          <AppText preset="caption" color={colors.text.secondary} style={styles.title}>저장 용량 — 종류별</AppText>
          <View style={styles.donutRow}>
            <DonutChart segments={kindSegs} centerValue={fmtBytes(bytes)} centerLabel="전체" />
            <ChartLegend items={kindLegend} />
          </View>
        </View>
      )}

      {/* 압축 단계 분포 도넛 — 영상만 (녹음은 압축 비대상) */}
      {dist.videoCount > 0 && (
        <View style={styles.section}>
          <AppText preset="caption" color={colors.text.secondary} style={styles.title}>압축 단계 분포 (영상)</AppText>
          <View style={styles.donutRow}>
            <DonutChart segments={levelSegs} centerValue={`${dist.videoCount}`} centerLabel="영상" />
            <ChartLegend items={levelLegend} />
          </View>
          {dist.audioCount > 0 && (
            <AppText preset="caption" color={colors.text.tertiary}>
              녹음 {dist.audioCount}개는 압축 대상이 아니에요(백업만 가능).
            </AppText>
          )}
        </View>
      )}

      {/* 백업 상태 — 누적 막대 */}
      {dist.mediaCount > 0 && (
        <View style={styles.section}>
          <AppText preset="caption" color={colors.text.secondary} style={styles.title}>백업 상태</AppText>
          <SegmentBar segments={backupSegs} />
          <ChartLegend items={backupLegend} />
        </View>
      )}

      {/* 월별 추세 — 영역 라인 */}
      {months.length > 0 && (
        <View style={styles.section}>
          <AppText preset="caption" color={colors.text.secondary} style={styles.title}>월별 용량 추세</AppText>
          <TrendLineChart points={months} formatValue={fmtBytes} />
        </View>
      )}

      {/* 카테고리별 결정 — 색상 막대 */}
      <View style={styles.section}>
        <AppText preset="caption" color={colors.text.secondary} style={styles.title}>카테고리별 결정</AppText>
        {stats.byCategory.length === 0 ? (
          <AppText preset="bodySmall" color={colors.text.tertiary}>아직 확정된 결정이 없어요</AppText>
        ) : (
          <View style={styles.chart}>
            {stats.byCategory.map((c, i) => (
              <View key={c.category} style={styles.barRow}>
                <AppText preset="caption" color={colors.text.secondary} style={styles.barLabel}>
                  {CATEGORY_LABELS[c.category] ?? c.category}
                </AppText>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(c.count / maxCat) * 100}%`, backgroundColor: catColors[i % catColors.length] }]} />
                </View>
                <AppText preset="caption" color={colors.text.secondary} style={styles.barCount}>{c.count}</AppText>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <View style={[styles.tile, { borderLeftColor: accent }]}>
      <AppText preset="caption" color={colors.text.tertiary}>{label}</AppText>
      <AppText preset="displayMedium" numberOfLines={1} style={styles.tileValue}>{value}</AppText>
      {sub && <AppText preset="caption" color={colors.text.tertiary}>{sub}</AppText>}
    </View>
  );
}

function SegmentBar({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <View style={styles.segBar}>
      {total === 0
        ? <View style={[styles.segFill, { flex: 1, backgroundColor: colors.chart.track }]} />
        : segments.map((s, i) => (
            s.value > 0 ? <View key={i} style={[styles.segFill, { flex: s.value, backgroundColor: s.color }]} /> : null
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  loader: { paddingVertical: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1, flexBasis: '30%', minWidth: 96,
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    borderLeftWidth: 3,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: spacing.xs,
  },
  tileValue: { marginTop: spacing.xs },
  section: { gap: spacing.sm },
  title: { marginTop: spacing.xs },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  segBar: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  segFill: { height: '100%' },
  chart: { gap: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 44 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.chart.track, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  barCount: { width: 24, textAlign: 'right' },
});
