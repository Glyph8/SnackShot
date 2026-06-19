/** @codemap 용량 관리(/storage) — 통계 + 단계/백업 상태별 조회·다중선택 일괄 관리
 *  데이터: @/db(getAllMediaEntries·getSettings·enqueueJob·markOriginalPurged) · @/lib/storage
 *  관련: 영상 관리 P4 (SnackShot-VideoManagement-proposal.md)
 */
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Platform, Pressable, StyleSheet, ToastAndroid, View,
} from 'react-native';

import { SettingsStats } from '@/components/SettingsStats';
import { StorageEntryRow } from '@/components/storage/StorageEntryRow';
import { AppText, Button, ScreenBackground } from '@/components/ui';
import { enqueueJob, getAllMediaEntries, getSettings, markOriginalPurged } from '@/db';
import { deleteOriginalFile, entryOriginalBytes } from '@/lib/storage';
import { kickWorker } from '@/services/jobs/queue';
import { exportMonthZip } from '@/services/video/exportMonthZip';
import { colors, iconSize, layout, radius, spacing } from '@/theme';
import type { Entry } from '@/types/domain';

type LevelFilter = 'all' | 0 | 1 | 2 | 3;
type BackupFilter = 'all' | 'none' | 'backed' | 'purged';

function showToast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert(msg);
}

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)}GB`;
  if (b >= 1_048_576) return `${Math.round(b / 1_048_576)}MB`;
  if (b >= 1024) return `${Math.round(b / 1024)}KB`;
  return `${b}B`;
}

const LEVEL_OPTIONS: { key: LevelFilter; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 0, label: '원본' },
  { key: 1, label: 'L1' }, { key: 2, label: 'L2' }, { key: 3, label: 'L3' },
];
const BACKUP_OPTIONS: { key: BackupFilter; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'none', label: '미백업' },
  { key: 'backed', label: '백업됨' }, { key: 'purged', label: '정리됨' },
];

const isCompressEligible = (e: Entry, target: number) =>
  (e.mode === 'voice' || e.mode === 'silent') &&
  e.compressionStatus === 'done' && e.originalPurgedAt == null &&
  (e.compressionLevel ?? 0) < target;
const isBackupEligible = (e: Entry) => e.originalBackedUpAt == null && e.originalPurgedAt == null;
const isPurgeEligible = (e: Entry) => e.originalBackedUpAt != null && e.originalPurgedAt == null;

export default function StorageScreen() {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [backupFilter, setBackupFilter] = useState<BackupFilter>('all');
  const [backupConfigured, setBackupConfigured] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [list, settings] = await Promise.all([getAllMediaEntries(db), getSettings(db)]);
    setEntries(list);
    setBackupConfigured(!!settings.backupDirUri);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => entries.filter((e) => {
    if (levelFilter !== 'all' && (e.compressionLevel ?? 0) !== levelFilter) return false;
    if (backupFilter === 'none' && !(e.originalBackedUpAt == null && e.originalPurgedAt == null)) return false;
    if (backupFilter === 'backed' && e.originalBackedUpAt == null) return false;
    if (backupFilter === 'purged' && e.originalPurgedAt == null) return false;
    return true;
  }), [entries, levelFilter, backupFilter]);

  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected],
  );

  // 월별 내보내기 대상 — 미디어가 있는 달(최신순)
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(format(new Date(e.recordedAt), 'yyyy-MM'));
    return [...set].sort().reverse();
  }, [entries]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const afterAction = useCallback(async (msg: string) => {
    clearSelection();
    await load();
    showToast(msg);
  }, [clearSelection, load]);

  const runCompress = useCallback(async (target: 2 | 3) => {
    const targets = selectedEntries.filter((e) => isCompressEligible(e, target));
    if (targets.length === 0) { showToast('대상 없음'); return; }
    setBusy(true);
    try {
      for (const e of targets) {
        await enqueueJob(db, 'compression', e.id, 'entries', JSON.stringify({ level: target }));
      }
      kickWorker();
      await afterAction(`${targets.length}건 L${target} 압축 시작`);
    } finally { setBusy(false); }
  }, [db, selectedEntries, afterAction]);

  const runBackup = useCallback(async () => {
    if (!backupConfigured) {
      Alert.alert('백업 폴더 필요', '설정 → 영상 백업에서 백업 폴더를 먼저 선택하세요.');
      return;
    }
    const targets = selectedEntries.filter(isBackupEligible);
    if (targets.length === 0) { showToast('대상 없음'); return; }
    setBusy(true);
    try {
      for (const e of targets) await enqueueJob(db, 'original_backup', e.id, 'entries');
      kickWorker();
      await afterAction(`${targets.length}건 백업 시작`);
    } finally { setBusy(false); }
  }, [db, backupConfigured, selectedEntries, afterAction]);

  const runPurge = useCallback(() => {
    const targets = selectedEntries.filter(isPurgeEligible);
    if (targets.length === 0) { showToast('백업된 원본이 없음'); return; }
    const reclaim = targets.reduce((sum, e) => sum + entryOriginalBytes(e), 0);
    Alert.alert(
      '백업된 원본 삭제',
      `백업이 완료된 ${targets.length}건의 로컬 원본을 삭제합니다. 약 ${fmtBytes(reclaim)} 확보됩니다.\n삭제된 원본은 백업본에서만 복구할 수 있습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              for (const e of targets) {
                deleteOriginalFile(e);
                await markOriginalPurged(db, e.id);
              }
              await afterAction(`${targets.length}건 원본 삭제 · ${fmtBytes(reclaim)} 확보`);
            } finally { setBusy(false); }
          },
        },
      ],
    );
  }, [db, selectedEntries, afterAction]);

  const exportMonth = useCallback(async (month: string) => {
    setBusy(true);
    try {
      await exportMonthZip(month);
    } catch (e) {
      Alert.alert('내보내기 실패', String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const selectedCount = selected.size;

  const header = (
    <View style={styles.headerContent}>
      <SettingsStats />

      {months.length > 0 && (
        <>
          <AppText preset="caption" color={colors.text.secondary} style={styles.filterTitle}>
            월별 백업 (zip)
          </AppText>
          <View style={styles.monthList}>
            {months.map((m) => (
              <View key={m} style={styles.monthRow}>
                <AppText preset="bodyMedium" style={styles.flex}>{m}</AppText>
                <Button label="zip 내보내기" variant="secondary" size="sm" disabled={busy} onPress={() => exportMonth(m)} />
              </View>
            ))}
          </View>
          <AppText preset="caption" color={colors.text.tertiary}>
            그 달의 영상·압축본·썸네일을 하나의 zip으로 묶어 공유 시트로 내보냅니다.
          </AppText>
        </>
      )}

      <AppText preset="caption" color={colors.text.secondary} style={styles.filterTitle}>압축 단계</AppText>
      <FilterChips
        options={LEVEL_OPTIONS.map((o) => ({ key: String(o.key), label: o.label, active: levelFilter === o.key }))}
        onSelect={(k) => setLevelFilter(k === 'all' ? 'all' : (Number(k) as LevelFilter))}
      />
      <AppText preset="caption" color={colors.text.secondary} style={styles.filterTitle}>백업 상태</AppText>
      <FilterChips
        options={BACKUP_OPTIONS.map((o) => ({ key: o.key, label: o.label, active: backupFilter === o.key }))}
        onSelect={(k) => setBackupFilter(k as BackupFilter)}
      />

      {selectedCount > 0 && (
        <View style={styles.actionBar}>
          <View style={styles.actionBarTop}>
            <AppText preset="bodyMedium">{selectedCount}개 선택됨</AppText>
            <Pressable onPress={clearSelection} hitSlop={spacing.sm}>
              <AppText preset="caption" color={colors.text.link}>선택 해제</AppText>
            </Pressable>
          </View>
          <View style={styles.actionRow}>
            <Button label="L2 압축" variant="secondary" size="sm" disabled={busy} onPress={() => runCompress(2)} style={styles.actionBtn} />
            <Button label="L3 압축" variant="secondary" size="sm" disabled={busy} onPress={() => runCompress(3)} style={styles.actionBtn} />
          </View>
          <View style={styles.actionRow}>
            <Button label="원본 백업" variant="secondary" size="sm" disabled={busy} onPress={runBackup} style={styles.actionBtn} />
            <Button label="백업 원본 삭제" variant="destructive" size="sm" disabled={busy} onPress={runPurge} style={styles.actionBtn} />
          </View>
        </View>
      )}

      <AppText preset="caption" color={colors.text.tertiary} style={styles.listHint}>
        {filtered.length}개 · 행을 눌러 선택
      </AppText>
    </View>
  );

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.sm} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text.primary} />
        </Pressable>
        <AppText preset="titleMedium" style={styles.headerTitle}>용량 관리</AppText>
        <View style={styles.navBtn} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <StorageEntryRow entry={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </ScreenBackground>
  );
}

function FilterChips(
  { options, onSelect }:
  { options: { key: string; label: string; active: boolean }[]; onSelect(key: string): void },
) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onSelect(o.key)}
          style={[styles.chip, o.active && styles.chipActive]}
        >
          <AppText preset="bodySmall" color={o.active ? colors.brand.onPrimary : colors.text.secondary}>
            {o.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
  },
  navBtn: { width: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },

  list: { paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing['4xl'] },
  headerContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  filterTitle: { marginTop: spacing.sm },
  monthList: { gap: spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },

  actionBar: {
    marginTop: spacing.md, padding: spacing.md, gap: spacing.sm,
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
  },
  actionBarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1 },

  listHint: { marginTop: spacing.md },
});
