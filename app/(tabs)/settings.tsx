/** @codemap 설정 탭(/settings) — API 키·모델, 옵시디언 연동, 통계
 *  데이터: @/db(settings·stats·ObsidianExportStats) · services/obsidian · 잡 jobs/queue
 *  관련 ADR: 023(키 저장), 026(옵시디언)
 */
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, ToastAndroid, View,
} from 'react-native';

import { SettingsStats } from '@/components/SettingsStats';
import { KeyInputRow } from '@/components/settings/KeyInputRow';
import { ObsidianSyncSection } from '@/components/settings/ObsidianSyncSection';
import { AppText, CollapsibleSection, ScreenBackground } from '@/components/ui';
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
import {
  DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL, GEMINI_MODELS, OPENAI_STT_MODELS,
  deleteGeminiKey, deleteOpenAIKey, getGeminiKey, getGeminiModel, getOpenAIKey, getOpenAIModel,
  setGeminiKey, setGeminiModel, setOpenAIKey, setOpenAIModel,
} from '@/lib/env';
import { colors, layout, spacing } from '@/theme';

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert(msg);
  }
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const tabBarHeight = useBottomTabBarHeight();

  const [vaultUri, setVaultUri] = useState<string | null>(null);
  const [autoExport, setAutoExport] = useState(true);
  const [permissionValid, setPermissionValid] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [exportStats, setExportStats] = useState<ObsidianExportStats>({
    lastSuccessAt: null, pendingCount: 0, failedCount: 0,
  });

  // API 키 상태 — 마스킹 표시용 (실제 키 값은 state에 보관하지 않음)
  const [openAiKeySet, setOpenAiKeySet] = useState(false);
  const [geminiKeySet, setGeminiKeySet] = useState(false);
  const [openAiKeyInput, setOpenAiKeyInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [openAiModel, setOpenAiModelState] = useState(DEFAULT_OPENAI_MODEL);
  const [geminiModel, setGeminiModelState] = useState(DEFAULT_GEMINI_MODEL);

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

        // API 키 설정 여부만 확인 (값은 state에 노출 안 함) + 선택 모델
        const [oaiKey, gaiKey, oaiModel, gaiModel] = await Promise.all([
          getOpenAIKey(), getGeminiKey(), getOpenAIModel(), getGeminiModel(),
        ]);
        if (!mounted) return;
        setOpenAiKeySet(!!oaiKey);
        setGeminiKeySet(!!gaiKey);
        setOpenAiModelState(oaiModel);
        setGeminiModelState(gaiModel);

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

  const handleSaveOpenAiKey = useCallback(async () => {
    const key = openAiKeyInput.trim();
    if (!key) return;
    await setOpenAIKey(key);
    setOpenAiKeySet(true);
    setOpenAiKeyInput('');
    showToast('OpenAI 키 저장됨');
  }, [openAiKeyInput]);

  const handleDeleteOpenAiKey = useCallback(async () => {
    await deleteOpenAIKey();
    setOpenAiKeySet(false);
    showToast('OpenAI 키 삭제됨');
  }, []);

  const handleSaveGeminiKey = useCallback(async () => {
    const key = geminiKeyInput.trim();
    if (!key) return;
    await setGeminiKey(key);
    setGeminiKeySet(true);
    setGeminiKeyInput('');
    showToast('Gemini 키 저장됨');
  }, [geminiKeyInput]);

  const handleDeleteGeminiKey = useCallback(async () => {
    await deleteGeminiKey();
    setGeminiKeySet(false);
    showToast('Gemini 키 삭제됨');
  }, []);

  const handleSelectOpenAiModel = useCallback(async (m: string) => {
    setOpenAiModelState(m);
    await setOpenAIModel(m);
  }, []);

  const handleSelectGeminiModel = useCallback(async (m: string) => {
    setGeminiModelState(m);
    await setGeminiModel(m);
  }, []);

  if (!initialized) {
    return (
      <ScreenBackground edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.brand.primary} /></View>
      </ScreenBackground>
    );
  }

  const isConnected = vaultUri !== null;
  const folderName = vaultUri ? getVaultFolderName(vaultUri) : null;
  const hasFailures = exportStats.failedCount > 0;
  const hasPending = exportStats.pendingCount > 0;

  return (
    <ScreenBackground edges={['top']}>
      {/* Android edge-to-edge에서 adjustResize가 무력화되므로 padding으로 하단 API 키 입력을 키보드 위로 올린다 */}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}>
        <AppText preset="displayLarge" style={styles.title}>설정</AppText>

        {/* ── 통계 (맨 위, 기본 접힘) ── */}
        <CollapsibleSection title="통계">
          <SettingsStats />
        </CollapsibleSection>

        {/* ── 옵시디언 연동 (기본 접힘) ── */}
        <ObsidianSyncSection
          isConnected={isConnected}
          folderName={folderName}
          connecting={connecting}
          permissionValid={permissionValid}
          autoExport={autoExport}
          exportStats={exportStats}
          onConnect={handleConnect}
          onReconnect={handleReconnect}
          onDisconnect={handleDisconnect}
          onAutoExportToggle={handleAutoExportToggle}
          onRetryFailed={handleRetryFailed}
          onReexportAll={handleReexportAll}
        />

        {/* ── API 키 (기본 접힘) ── */}
        <CollapsibleSection title="API 키" hint={openAiKeySet || geminiKeySet ? '키 저장됨' : '미설정'}>
          <View style={styles.card}>
            <KeyInputRow
              label="OpenAI (음성 인식)"
              isSet={openAiKeySet}
              value={openAiKeyInput}
              onChangeText={setOpenAiKeyInput}
              onSave={handleSaveOpenAiKey}
              onDelete={handleDeleteOpenAiKey}
              models={OPENAI_STT_MODELS}
              selectedModel={openAiModel}
              onSelectModel={handleSelectOpenAiModel}
            />
            <View style={styles.divider} />
            <KeyInputRow
              label="Google Gemini (결정 추출)"
              isSet={geminiKeySet}
              value={geminiKeyInput}
              onChangeText={setGeminiKeyInput}
              onSave={handleSaveGeminiKey}
              onDelete={handleDeleteGeminiKey}
              models={GEMINI_MODELS}
              selectedModel={geminiModel}
              onSelectModel={handleSelectGeminiModel}
            />
          </View>
        </CollapsibleSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginBottom: spacing.lg },
  card: { gap: spacing.lg },
  divider: { height: 1, backgroundColor: colors.border.hairline },
});
