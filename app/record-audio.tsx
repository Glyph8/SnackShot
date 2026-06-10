import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { nowMs } from '@/lib/time';

const MAX_SECS = 180;
const MIN_SECS = 3;

export default function RecordAudioScreen() {
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);

  const recordStartRef = useRef(0);
  const cancelledRef = useRef(false);
  const preparingRef = useRef(false);

  useEffect(() => {
    async function check() {
      const res = await requestRecordingPermissionsAsync();
      setPermGranted(res.granted);
      setCanAskAgain(res.canAskAgain);
    }
    check();
  }, []);

  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );

  const handleRecord = useCallback(async () => {
    if (preparingRef.current) return;

    if (recState.isRecording) {
      const startMs = recordStartRef.current;
      await recorder.stop();
      if (cancelledRef.current) return;

      const uri = recorder.uri;
      if (!uri) return;

      const durationMs = Date.now() - startMs;
      if (durationMs < MIN_SECS * 1000) {
        Alert.alert('너무 짧아요', `${MIN_SECS}초 이상 녹음해야 저장됩니다.`);
        return;
      }
      router.replace({
        pathname: '/preview-audio',
        params: { uri, durationMs: String(durationMs), recordedAt: String(startMs) },
      });
    } else {
      preparingRef.current = true;
      cancelledRef.current = false;
      recordStartRef.current = nowMs();
      await recorder.prepareToRecordAsync();
      if (!cancelledRef.current) recorder.record();
      preparingRef.current = false;
    }
  }, [recorder, recState.isRecording]);

  const handleClose = useCallback(async () => {
    cancelledRef.current = true;
    if (recState.isRecording) await recorder.stop();
    router.back();
  }, [recorder, recState.isRecording]);

  if (permGranted === null) return <View style={styles.loading} />;

  if (!permGranted) {
    return (
      <SafeAreaView style={styles.permission}>
        <Text style={styles.permTitle}>마이크{'\n'}접근을 허용해 주세요</Text>
        <Text style={styles.permDesc}>음성을 녹음하려면{'\n'}마이크 권한이 필요해요.</Text>
        {canAskAgain ? (
          <Pressable
            style={styles.permBtn}
            onPress={async () => {
              const res = await requestRecordingPermissionsAsync();
              setPermGranted(res.granted);
              setCanAskAgain(res.canAskAgain);
            }}
          >
            <Text style={styles.permBtnText}>권한 허용하기</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.permBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnText}>설정에서 허용하기 →</Text>
          </Pressable>
        )}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const elapsed = Math.floor(recState.durationMillis / 1000);
  const remaining = MAX_SECS - elapsed;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <SafeAreaView style={styles.root}>
      {/* 상단: 닫기 + 타이머 */}
      <View style={styles.topBar}>
        <Pressable hitSlop={16} onPress={handleClose} style={styles.closeBtn}>
          <Text style={styles.closeTxt}>✕</Text>
        </Pressable>
        {recState.isRecording && (
          <View style={styles.timerRow}>
            <View style={styles.recDot} />
            <Text style={styles.timerTxt}>{mm}:{ss}</Text>
          </View>
        )}
      </View>

      {/* 중앙: 상태 표시 */}
      <View style={styles.center}>
        <View style={styles.micWrap}>
          <Text style={styles.micEmoji}>{recState.isRecording ? '🎙' : '🎤'}</Text>
        </View>
        <Text style={styles.statusTxt}>
          {recState.isRecording ? '녹음 중…' : '버튼을 눌러 녹음 시작'}
        </Text>
        {recState.isRecording && elapsed < MIN_SECS && (
          <Text style={styles.minHint}>{MIN_SECS - elapsed}초 더 녹음하면 저장돼요</Text>
        )}
      </View>

      {/* 하단: 녹음 버튼 */}
      <View style={styles.bottomBar}>
        <Pressable onPress={handleRecord} style={styles.outerRing}>
          <View style={[styles.innerCircle, recState.isRecording && styles.stopSquare]} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#111' },
  root: { flex: 1, backgroundColor: '#111' },

  permission: {
    flex: 1, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center', padding: 36,
  },
  permTitle: {
    fontSize: 22, fontWeight: '600', color: '#fff',
    textAlign: 'center', lineHeight: 32, marginBottom: 14,
  },
  permDesc: {
    fontSize: 15, color: '#999', textAlign: 'center',
    lineHeight: 22, marginBottom: 44,
  },
  permBtn: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 36, paddingVertical: 15, marginBottom: 14,
  },
  permBtnText: { fontSize: 16, fontWeight: '600', color: '#000' },
  backBtn: { paddingVertical: 10 },
  backBtnText: { fontSize: 15, color: '#666' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 15, color: '#fff', fontWeight: '500' },
  timerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6, gap: 6,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b30' },
  timerTxt: { fontSize: 16, fontWeight: '600', color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  micWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  micEmoji: { fontSize: 44 },
  statusTxt: { fontSize: 16, color: '#ccc', fontWeight: '500' },
  minHint: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  bottomBar: {
    alignItems: 'center', paddingBottom: 56,
  },
  outerRing: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  stopSquare: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#ff3b30' },
});
