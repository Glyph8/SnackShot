import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CATEGORY_LABELS } from '@/components/DecisionCardBody';
import { AppText } from '@/components/ui';
import { getAllEntryMedia, getEntryStats, type EntryStats } from '@/db';
import { getEntriesStorageBytes, getStorageBreakdown, type StorageBreakdown } from '@/lib/storage';
import { colors, radius, spacing } from '@/theme';

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)}GB`;
  if (b >= 1_048_576) return `${Math.round(b / 1_048_576)}MB`;
  if (b >= 1024) return `${Math.round(b / 1024)}KB`;
  return `${b}B`;
}

const MONTH_LABEL = (m: string) => `${Number(m.slice(5, 7))}월`; // 'YYYY-MM' → 'M월'

function ByteBar({ label, bytes, max }: { label: string; bytes: number; max: number }) {
  return (
    <View style={styles.barRow}>
      <AppText preset="caption" color={colors.text.secondary} style={styles.barLabelWide}>{label}</AppText>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${max > 0 ? (bytes / max) * 100 : 0}%` }]} />
      </View>
      <AppText preset="caption" color={colors.text.secondary} style={styles.barBytes}>{fmtBytes(bytes)}</AppText>
    </View>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.card}>
      <AppText preset="caption" color={colors.text.tertiary}>{label}</AppText>
      <AppText preset="displayMedium" numberOfLines={1} style={styles.cardValue}>{value}</AppText>
      {sub && <AppText preset="caption" color={colors.text.tertiary}>{sub}</AppText>}
    </View>
  );
}

export function SettingsStats() {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<EntryStats | null>(null);
  const [bytes, setBytes] = useState(0);
  const [storage, setStorage] = useState<StorageBreakdown | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const s = await getEntryStats(db);
          const media = await getAllEntryMedia(db);
          const b = getEntriesStorageBytes();
          const sb = getStorageBreakdown(media);
          if (mounted) { setStats(s); setBytes(b); setStorage(sb); }
        } catch (e) {
          console.error('[stats] load failed', e);
        }
      })();
      return () => { mounted = false; };
    }, [db]),
  );

  if (!stats) return <ActivityIndicator color={colors.brand.primary} style={styles.loader} />;

  const confirmRate = stats.decisionsTotal > 0
    ? Math.round((stats.decisionsConfirmed / stats.decisionsTotal) * 100)
    : null;
  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.count));

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <StatCard label="총 클립" value={String(stats.totalClips)} />
        <StatCard label="총 분량" value={fmtDuration(stats.totalDurationMs)} />
        <StatCard label="기록한 날" value={`${stats.daysRecorded}일`} />
        <StatCard label="저장 용량" value={fmtBytes(bytes)} />
        <StatCard label="확정 결정" value={String(stats.decisionsConfirmed)} sub={`검토 대기 ${stats.decisionsPending}`} />
        <StatCard label="컨펌율" value={confirmRate === null ? '—' : `${confirmRate}%`} sub={`확정 ${stats.decisionsConfirmed} / 전체 ${stats.decisionsTotal}`} />
      </View>

      {/* 카테고리별 확정 결정 */}
      <AppText preset="caption" color={colors.text.secondary} style={styles.chartTitle}>카테고리별 결정</AppText>
      {stats.byCategory.length === 0 ? (
        <AppText preset="bodySmall" color={colors.text.tertiary}>아직 확정된 결정이 없어요</AppText>
      ) : (
        <View style={styles.chart}>
          {stats.byCategory.map((c) => (
            <View key={c.category} style={styles.barRow}>
              <AppText preset="caption" color={colors.text.secondary} style={styles.barLabel}>
                {CATEGORY_LABELS[c.category] ?? c.category}
              </AppText>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(c.count / maxCat) * 100}%` }]} />
              </View>
              <AppText preset="caption" color={colors.text.secondary} style={styles.barCount}>{c.count}</AppText>
            </View>
          ))}
        </View>
      )}

      {/* 모드 분포 */}
      <AppText preset="caption" color={colors.text.secondary} style={styles.chartTitle}>유형</AppText>
      <AppText preset="bodySmall" color={colors.text.secondary}>
        {`영상 ${stats.byMode.voice} · 조용 ${stats.byMode.silent} · 음성 ${stats.byMode.audio} · 메모 ${stats.byMode.text}`}
      </AppText>

      {/* 저장 용량 상세 */}
      {storage && (() => {
        const orphan = Math.max(0, bytes - storage.entriesTotal);
        const kindMax = Math.max(1, storage.byKind.original, storage.byKind.compressed, storage.byKind.thumbnail, orphan);
        const modeMax = Math.max(1, storage.byMode.video, storage.byMode.audio);
        const months = storage.byMonth.slice(0, 6);
        const monthMax = Math.max(1, ...months.map((m) => m.bytes));
        return (
          <View style={styles.section}>
            <AppText preset="caption" color={colors.text.secondary} style={styles.chartTitle}>저장 용량 — 종류별</AppText>
            <View style={styles.chart}>
              <ByteBar label="원본" bytes={storage.byKind.original} max={kindMax} />
              <ByteBar label="압축본" bytes={storage.byKind.compressed} max={kindMax} />
              <ByteBar label="썸네일" bytes={storage.byKind.thumbnail} max={kindMax} />
              {orphan > 0 && <ByteBar label="미사용" bytes={orphan} max={kindMax} />}
            </View>

            <AppText preset="caption" color={colors.text.secondary} style={styles.chartTitle}>유형별</AppText>
            <View style={styles.chart}>
              <ByteBar label="영상" bytes={storage.byMode.video} max={modeMax} />
              <ByteBar label="음성" bytes={storage.byMode.audio} max={modeMax} />
            </View>

            {months.length > 0 && (
              <>
                <AppText preset="caption" color={colors.text.secondary} style={styles.chartTitle}>월별 (최근)</AppText>
                <View style={styles.chart}>
                  {months.map((m) => (
                    <ByteBar key={m.month} label={MONTH_LABEL(m.month)} bytes={m.bytes} max={monthMax} />
                  ))}
                </View>
              </>
            )}

            {orphan > 0 && (
              <AppText preset="caption" color={colors.text.tertiary}>
                미사용 = 삭제됐지만 정리 안 된 파일. 클립 삭제 시 "로컬 영상 파일도 삭제"로 줄일 수 있어요.
              </AppText>
            )}
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  loader: { paddingVertical: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexGrow: 1, flexBasis: '30%', minWidth: 96,
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: spacing.xs,
  },
  cardValue: { marginTop: spacing.xs },
  chartTitle: { marginTop: spacing.sm },
  chart: { gap: spacing.sm },
  section: { gap: spacing.md, marginTop: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 44 },
  barLabelWide: { width: 56 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surface.sunken, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand.primary },
  barCount: { width: 24, textAlign: 'right' },
  barBytes: { width: 52, textAlign: 'right' },
});
