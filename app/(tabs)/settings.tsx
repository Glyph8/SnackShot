/** @codemap 설정 탭(/settings) — API 키·모델, 옵시디언 연동, 통계
 *  데이터: @/db(settings·stats·ObsidianExportStats) · services/obsidian · 잡 jobs/queue
 *  관련 ADR: 023(키 저장), 026(옵시디언)
 */
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet,
  Switch, TextInput, ToastAndroid, View,
} from 'react-native';

import { SettingsStats } from '@/components/SettingsStats';
import { AppText, Button, CollapsibleSection, ScreenBackground } from '@/components/ui';
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
  type ModelOption,
} from '@/lib/env';
import { colors, layout, radius, spacing } from '@/theme';

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
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}>
        <AppText preset="displayLarge" style={styles.title}>설정</AppText>

        {/* ── 통계 (맨 위, 기본 접힘) ── */}
        <CollapsibleSection title="통계">
          <SettingsStats />
        </CollapsibleSection>

        {/* ── 옵시디언 연동 (기본 접힘) ── */}
        <CollapsibleSection title="옵시디언 연동" hint={isConnected ? (folderName ?? '연결됨') : '미연결'}>
          {!isConnected ? (
            /* 미연결 상태 */
            <View style={styles.card}>
              <AppText preset="bodyMedium" color={colors.text.secondary}>
                옵시디언 폴더를 연결하면 일기가 마크다운으로 내보내집니다.
              </AppText>
              <Button
                label={connecting ? '연결 중…' : '폴더 선택'}
                onPress={handleConnect}
                disabled={connecting}
                fullWidth
              />
            </View>
          ) : (
            /* 연결됨 상태 */
            <View style={styles.card}>
              {/* 권한 만료 경고 */}
              {!permissionValid && (
                <View style={styles.warningBanner}>
                  <AppText preset="bodySmall" color={colors.feedback.warning}>
                    ⚠ 다시 연결이 필요합니다 — 저장소 권한이 만료되었습니다.
                  </AppText>
                  <Button
                    label={connecting ? '연결 중…' : '다시 연결'}
                    onPress={handleReconnect}
                    disabled={connecting}
                    size="sm"
                  />
                </View>
              )}

              {/* export 실패 경고 배너 */}
              {hasFailures && (
                <View style={styles.warningBanner}>
                  <AppText preset="bodySmall" color={colors.feedback.warning}>
                    ⚠ 내보내기 실패 {exportStats.failedCount}건이 누적되어 있습니다.
                  </AppText>
                  <View style={styles.bannerActions}>
                    <Button label="다시 시도" onPress={handleRetryFailed} size="sm" style={styles.btnFlex} />
                    <Button label="다시 연결" variant="secondary" onPress={handleReconnect} disabled={connecting} size="sm" style={styles.btnFlex} />
                  </View>
                </View>
              )}

              {/* 연결된 폴더 */}
              <View style={styles.row}>
                <View style={styles.folderInfo}>
                  <AppText preset="caption" color={colors.text.secondary}>연결된 폴더</AppText>
                  <AppText preset="bodyLarge" numberOfLines={1}>{folderName}</AppText>
                </View>
                <Button label="연결 해제" variant="secondary" size="sm" onPress={handleDisconnect} />
              </View>

              {/* export 상태 */}
              <View style={styles.statsRow}>
                <View>
                  <AppText preset="caption" color={colors.text.secondary}>마지막 내보내기</AppText>
                  <AppText preset="bodySmall" color={colors.text.secondary}>
                    {fmtLastExport(exportStats.lastSuccessAt)}
                  </AppText>
                </View>
                {(hasPending || hasFailures) && (
                  <AppText preset="caption" color={colors.feedback.warning}>
                    {hasPending ? `대기 ${exportStats.pendingCount}건` : ''}
                    {hasPending && hasFailures ? ' · ' : ''}
                    {hasFailures ? `실패 ${exportStats.failedCount}건` : ''}
                  </AppText>
                )}
              </View>

              {/* 자동 내보내기 토글 */}
              <View style={[styles.row, styles.toggleRow]}>
                <View>
                  <AppText preset="bodyLarge">자동 내보내기</AppText>
                  <AppText preset="caption" color={colors.text.tertiary}>저장 즉시 마크다운 파일 생성</AppText>
                </View>
                <Switch
                  value={autoExport}
                  onValueChange={handleAutoExportToggle}
                  trackColor={{ false: colors.border.card, true: colors.brand.primary }}
                  thumbColor={colors.surface.paperRaised}
                />
              </View>

              {/* 전체 다시 내보내기 */}
              <Button label="전체 다시 내보내기" variant="secondary" onPress={handleReexportAll} fullWidth />
            </View>
          )}
        </CollapsibleSection>

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
    </ScreenBackground>
  );
}

// ─── 키 입력 행 컴포넌트 ────────────────────────────────────────────────────────

interface KeyInputRowProps {
  label: string;
  isSet: boolean;
  value: string;
  onChangeText(v: string): void;
  onSave(): void;
  onDelete(): void;
  models: ModelOption[];
  selectedModel: string;
  onSelectModel(m: string): void;
}

function KeyInputRow({
  label, isSet, value, onChangeText, onSave, onDelete,
  models, selectedModel, onSelectModel,
}: KeyInputRowProps) {
  return (
    <View style={styles.keyRow}>
      <AppText preset="bodyLarge">{label}</AppText>
      {isSet ? (
        <View style={styles.keySetRow}>
          <AppText preset="caption" color={colors.text.tertiary}>●●●●●●●● 저장됨</AppText>
          <Button label="삭제" variant="secondary" size="sm" onPress={onDelete} />
        </View>
      ) : (
        <View style={styles.keyInputRow}>
          <TextInput
            style={styles.keyInput}
            value={value}
            onChangeText={onChangeText}
            placeholder="sk-... 또는 AI... 입력"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button label="저장" onPress={onSave} disabled={!value.trim()} size="sm" />
        </View>
      )}

      {/* 모델 선택 */}
      <AppText preset="caption" color={colors.text.secondary} style={styles.modelLabel}>모델</AppText>
      <View style={styles.modelRow}>
        {models.map((m) => {
          const on = m.value === selectedModel;
          return (
            <Pressable
              key={m.value}
              onPress={() => onSelectModel(m.value)}
              style={[styles.modelChip, on && styles.modelChipOn]}
            >
              <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  title: { marginBottom: spacing.lg },

  card: { gap: spacing.lg },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRow: { paddingTop: spacing.xs },

  folderInfo: { flex: 1, marginRight: spacing.md },

  statsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },

  warningBanner: {
    backgroundColor: colors.feedback.warningTrack,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.feedback.warning,
  },
  bannerActions: { flexDirection: 'row', gap: spacing.sm },
  btnFlex: { flex: 1 },

  divider: { height: 1, backgroundColor: colors.border.hairline },

  keyRow: { gap: spacing.sm },
  modelLabel: { marginTop: spacing.xs },
  modelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modelChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  modelChipOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  keySetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keyInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  keyInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border.card, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 13, color: colors.text.primary,
    backgroundColor: colors.surface.paperRaised,
  },
});
