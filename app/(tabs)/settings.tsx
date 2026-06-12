import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform,
  Pressable, ScrollView, StyleSheet,
  Switch, Text, ToastAndroid, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cancelPendingObsidianExports, countAllEntries, getAllEntryIds,
  getObsidianExportStats, getSettings,
  retryFailedObsidianExports,
  setObsidianAutoExport, setObsidianVaultUri,
} from '@/db';
import type { ObsidianExportStats } from '@/db';
import { kickWorker } from '@/services/jobs/queue';
import {
  checkVaultPermission, enqueueBulkExport,
  getVaultFolderName, pickVaultDirectory, setupSnackShotFolder,
} from '@/services/obsidian';

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert(msg);
  }
}

function fmtLastExport(ms: number | null): string {
  if (!ms) return '아직 내보내지 않음';
  return formatDistanceToNow(new Date(ms), { addSuffix: true, locale: ko });
}

export default function SettingsScreen() {
  const db = useSQLiteContext();

  const [vaultUri, setVaultUri] = useState<string | null>(null);
  const [autoExport, setAutoExport] = useState(true);
  const [permissionValid, setPermissionValid] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [exportStats, setExportStats] = useState<ObsidianExportStats>({
    lastSuccessAt: null, pendingCount: 0, failedCount: 0,
  });

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(async () => {
    const stats = await getObsidianExportStats(db);
    setExportStats(stats);
    return stats;
  }, [db]);

  // 포커스 진입 시 설정 + stats 로드, pending이면 폴링 시작
  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      (async () => {
        const s = await getSettings(db);
        if (!mounted) return;
        setVaultUri(s.obsidianVaultUri);
        setAutoExport(s.obsidianAutoExport);
        if (s.obsidianVaultUri) {
          setPermissionValid(checkVaultPermission(s.obsidianVaultUri));
        }
        setInitialized(true);

        const stats = await loadStats();
        if (!mounted) return;

        if (stats.pendingCount > 0) {
          pollTimerRef.current = setInterval(async () => {
            const fresh = await loadStats();
            if (fresh.pendingCount === 0 && pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }, 5_000);
        }
      })();

      return () => {
        mounted = false;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };
    }, [db, loadStats]),
  );

  // pending 개수 변화 감지 → 0이 되면 폴링 중단
  useEffect(() => {
    if (exportStats.pendingCount === 0 && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [exportStats.pendingCount]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const dir = await pickVaultDirectory();
      if (!dir) return;

      setupSnackShotFolder(dir);
      await setObsidianVaultUri(db, dir.uri);
      setVaultUri(dir.uri);
      setPermissionValid(true);
      showToast('연결 완료');

      // 첫 연결 직후 — 기존 일기 일괄 export 제안
      const total = await countAllEntries(db);
      if (total > 0) {
        Alert.alert(
          '기존 일기 내보내기',
          `기존 일기 ${total}개를 지금 내보낼까요?`,
          [
            { text: '나중에', style: 'cancel' },
            {
              text: '지금 내보내기',
              onPress: async () => {
                const ids = await getAllEntryIds(db);
                const jobCount = await enqueueBulkExport(db, ids);
                kickWorker();
                showToast(`${jobCount}일치 내보내기 시작`);
                await loadStats();
              },
            },
          ],
        );
      }
    } catch (e) {
      Alert.alert(
        '연결 실패',
        `폴더 초기화 중 오류가 발생했습니다.\n${String(e)}\n\n다시 시도해주세요.`,
      );
    } finally {
      setConnecting(false);
    }
  }, [db, loadStats]);

  const handleDisconnect = useCallback(() => {
    Alert.alert('연결 해제', '옵시디언 연동을 해제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        style: 'destructive',
        onPress: async () => {
          await setObsidianVaultUri(db, null);
          setVaultUri(null);
          setPermissionValid(true);
        },
      },
    ]);
  }, [db]);

  const handleAutoExportToggle = useCallback(
    async (value: boolean) => {
      setAutoExport(value);
      await setObsidianAutoExport(db, value);
    },
    [db],
  );

  const handleReconnect = useCallback(async () => {
    await handleConnect();
  }, [handleConnect]);

  const handleRetryFailed = useCallback(async () => {
    const count = await retryFailedObsidianExports(db);
    kickWorker();
    showToast(`${count}건 재시도 시작`);
    await loadStats();
  }, [db, loadStats]);

  const handleReexportAll = useCallback(async () => {
    const total = await countAllEntries(db);
    Alert.alert(
      '전체 다시 내보내기',
      `${total}개 일기를 내보냅니다.\n기존 대기 잡은 취소됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '내보내기',
          onPress: async () => {
            await cancelPendingObsidianExports(db);
            const ids = await getAllEntryIds(db);
            const jobCount = await enqueueBulkExport(db, ids);
            kickWorker();
            showToast(`${jobCount}일치 내보내기 시작`);
            await loadStats();
          },
        },
      ],
    );
  }, [db, loadStats]);

  if (!initialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#888" /></View>
      </SafeAreaView>
    );
  }

  const isConnected = vaultUri !== null;
  const folderName = vaultUri ? getVaultFolderName(vaultUri) : null;
  const hasFailures = exportStats.failedCount > 0;
  const hasPending = exportStats.pendingCount > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>설정</Text>

        {/* ── 옵시디언 연동 섹션 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>옵시디언 연동</Text>

          {!isConnected ? (
            /* 미연결 상태 */
            <View style={styles.card}>
              <Text style={styles.description}>
                옵시디언 폴더를 연결하면 일기가 마크다운으로 내보내집니다.
              </Text>
              <Pressable
                style={[styles.btn, styles.btnPrimary, connecting && styles.btnDisabled]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryTxt}>폴더 선택</Text>
                )}
              </Pressable>
            </View>
          ) : (
            /* 연결됨 상태 */
            <View style={styles.card}>
              {/* 권한 만료 경고 */}
              {!permissionValid && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningTxt}>
                    ⚠ 다시 연결이 필요합니다 — 저장소 권한이 만료되었습니다.
                  </Text>
                  <Pressable
                    style={[styles.btn, styles.btnWarning]}
                    onPress={handleReconnect}
                    disabled={connecting}
                  >
                    <Text style={styles.btnWarningTxt}>
                      {connecting ? '연결 중…' : '다시 연결'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* export 실패 경고 배너 */}
              {hasFailures && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningTxt}>
                    ⚠ 내보내기 실패 {exportStats.failedCount}건이 누적되어 있습니다.
                  </Text>
                  <View style={styles.bannerActions}>
                    <Pressable
                      style={[styles.btn, styles.btnWarning, styles.btnFlex]}
                      onPress={handleRetryFailed}
                    >
                      <Text style={styles.btnWarningTxt}>다시 시도</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnSecondary, styles.btnFlex]}
                      onPress={handleReconnect}
                      disabled={connecting}
                    >
                      <Text style={styles.btnSecondaryTxt}>다시 연결</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 연결된 폴더 */}
              <View style={styles.row}>
                <View style={styles.folderInfo}>
                  <Text style={styles.label}>연결된 폴더</Text>
                  <Text style={styles.folderName} numberOfLines={1}>{folderName}</Text>
                </View>
                <Pressable
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={handleDisconnect}
                >
                  <Text style={styles.btnSecondaryTxt}>연결 해제</Text>
                </Pressable>
              </View>

              {/* export 상태 */}
              <View style={styles.statsRow}>
                <View>
                  <Text style={styles.label}>마지막 내보내기</Text>
                  <Text style={styles.statsValue}>
                    {fmtLastExport(exportStats.lastSuccessAt)}
                  </Text>
                </View>
                {(hasPending || hasFailures) && (
                  <Text style={styles.statsBadge}>
                    {hasPending ? `대기 ${exportStats.pendingCount}건` : ''}
                    {hasPending && hasFailures ? ' · ' : ''}
                    {hasFailures ? `실패 ${exportStats.failedCount}건` : ''}
                  </Text>
                )}
              </View>

              {/* 자동 내보내기 토글 */}
              <View style={[styles.row, styles.toggleRow]}>
                <View>
                  <Text style={styles.label}>자동 내보내기</Text>
                  <Text style={styles.hint}>저장 즉시 마크다운 파일 생성</Text>
                </View>
                <Switch
                  value={autoExport}
                  onValueChange={handleAutoExportToggle}
                  trackColor={{ false: '#d0d0d0', true: '#111' }}
                  thumbColor="#fff"
                />
              </View>

              {/* 전체 다시 내보내기 */}
              <Pressable
                style={[styles.btn, styles.btnSecondary, styles.btnFull]}
                onPress={handleReexportAll}
              >
                <Text style={styles.btnSecondaryTxt}>전체 다시 내보내기</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  title: { fontSize: 22, fontWeight: '500', marginBottom: 28 },

  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#aaa',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10,
  },

  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    padding: 16,
    gap: 14,
  },

  description: { fontSize: 14, color: '#555', lineHeight: 20 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  toggleRow: { paddingTop: 4 },

  folderInfo: { flex: 1, marginRight: 12 },
  label: { fontSize: 12, color: '#888', fontWeight: '500', marginBottom: 2 },
  folderName: { fontSize: 15, fontWeight: '600', color: '#111' },
  hint: { fontSize: 12, color: '#bbb', marginTop: 2 },

  statsRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  statsValue: { fontSize: 13, color: '#555' },
  statsBadge: { fontSize: 12, color: '#b45309', fontWeight: '500', paddingTop: 2 },

  warningBanner: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fed7aa',
  },
  warningTxt: { fontSize: 13, color: '#9a3412', lineHeight: 18 },
  bannerActions: { flexDirection: 'row', gap: 8 },

  // ── 버튼 공통 ──────────────────────────────────────────────────────────────
  btn: {
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
  btnFlex: { flex: 1 },
  btnFull: { alignSelf: 'stretch' },
  btnDisabled: { opacity: 0.6 },

  btnPrimary: { backgroundColor: '#111' },
  btnPrimaryTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },

  btnSecondary: {
    borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: '#fff',
  },
  btnSecondaryTxt: { fontSize: 13, color: '#555', fontWeight: '500' },

  btnWarning: { backgroundColor: '#9a3412' },
  btnWarningTxt: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
