import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform,
  Pressable, ScrollView, StyleSheet,
  Switch, Text, ToastAndroid, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getSettings, setObsidianAutoExport, setObsidianVaultUri,
} from '@/db';
import {
  checkVaultPermission, getVaultFolderName,
  pickVaultDirectory, setupSnackShotFolder,
} from '@/services/obsidian';

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert(msg);
  }
}

export default function SettingsScreen() {
  const db = useSQLiteContext();

  const [vaultUri, setVaultUri] = useState<string | null>(null);
  const [autoExport, setAutoExport] = useState(true);
  const [permissionValid, setPermissionValid] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = await getSettings(db);
        setVaultUri(s.obsidianVaultUri);
        setAutoExport(s.obsidianAutoExport);
        if (s.obsidianVaultUri) {
          setPermissionValid(checkVaultPermission(s.obsidianVaultUri));
        }
        setInitialized(true);
      })();
    }, [db]),
  );

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const dir = await pickVaultDirectory();
      if (!dir) return; // 사용자 취소

      setupSnackShotFolder(dir);

      await setObsidianVaultUri(db, dir.uri);
      setVaultUri(dir.uri);
      setPermissionValid(true);
      showToast('연결 완료');
    } catch (e) {
      Alert.alert(
        '연결 실패',
        `폴더 초기화 중 오류가 발생했습니다.\n${String(e)}\n\n다시 시도해주세요.`,
      );
    } finally {
      setConnecting(false);
    }
  }, [db]);

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

  if (!initialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#888" /></View>
      </SafeAreaView>
    );
  }

  const isConnected = vaultUri !== null;
  const folderName = vaultUri ? getVaultFolderName(vaultUri) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 타이틀 */}
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

  warningBanner: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fed7aa',
  },
  warningTxt: { fontSize: 13, color: '#9a3412', lineHeight: 18 },

  // ── 버튼 공통 ──────────────────────────────────────────────────────────────
  btn: {
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
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
