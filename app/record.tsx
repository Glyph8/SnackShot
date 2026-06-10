import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router } from 'expo-router';
import { nowMs } from '@/lib/time';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Linking, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_SECS = 180; // ADR-005: 3분 상한
const MIN_SECS = 3;   // 3초 미만은 저장하지 않음

export default function RecordScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const recordStartRef = useRef(0);    // 녹화 시작 시각 (UTC ms)
  const cancelledRef = useRef(false);  // 닫기/뒤로가기 시 record 결과 무시
  const requestedRef = useRef(false);  // 권한 요청 중복 방지

  // 권한 자동 요청 (최초 1회, 두 객체가 모두 로드된 뒤)
  useEffect(() => {
    if (requestedRef.current || !cameraPermission || !micPermission) return;
    requestedRef.current = true;
    async function ask() {
      if (!cameraPermission!.granted && cameraPermission!.canAskAgain) {
        await requestCameraPermission();
      }
      if (!micPermission!.granted && micPermission!.canAskAgain) {
        await requestMicPermission();
      }
    }
    ask();
  }, [cameraPermission, micPermission]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleRecord = useCallback(async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      cameraRef.current.stopRecording();
      return;
    }

    cancelledRef.current = false;
    elapsedRef.current = 0;
    recordStartRef.current = nowMs();
    setElapsed(0);
    setIsRecording(true);

    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);

    // maxDuration 도달 시 자동 resolve (ADR-005)
    const result = await cameraRef.current.recordAsync({ maxDuration: MAX_SECS });

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (cancelledRef.current) return;

    setIsRecording(false);

    if (!result?.uri) return;

    if (elapsedRef.current < MIN_SECS) {
      Alert.alert('너무 짧아요', `${MIN_SECS}초 이상 녹화해야 저장됩니다.`);
      return;
    }

    router.replace({
      pathname: '/preview',
      params: {
        uri: result.uri,
        durationMs: String(elapsedRef.current * 1000),
        recordedAt: String(recordStartRef.current),
      },
    });
  }, [isRecording]);

  const handleClose = useCallback(() => {
    cancelledRef.current = true;
    if (isRecording) cameraRef.current?.stopRecording();
    router.back();
  }, [isRecording]);

  // ── 권한 로딩 중 ──
  if (!cameraPermission || !micPermission) {
    return <View style={styles.loading} />;
  }

  // ── 권한 거부 ──
  if (!cameraPermission.granted || !micPermission.granted) {
    const canAsk = cameraPermission.canAskAgain || micPermission.canAskAgain;
    return (
      <SafeAreaView style={styles.permission}>
        <Text style={styles.permTitle}>카메라와 마이크{'\n'}접근을 허용해 주세요</Text>
        <Text style={styles.permDesc}>
          스냅샷을 녹화하려면{'\n'}두 가지 권한이 모두 필요해요.
        </Text>
        {canAsk ? (
          <Pressable
            style={styles.permBtn}
            onPress={async () => {
              if (!cameraPermission.granted && cameraPermission.canAskAgain) {
                await requestCameraPermission();
              }
              if (!micPermission.granted && micPermission.canAskAgain) {
                await requestMicPermission();
              }
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

  // ── 카운트다운 (남은 시간) ──
  const remaining = MAX_SECS - elapsed;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
        videoQuality="720p"
      />

      {/* 상단: 닫기 + 타이머 */}
      <SafeAreaView style={styles.topBar}>
        <Pressable hitSlop={16} onPress={handleClose} style={styles.closeBtn}>
          <Text style={styles.closeTxt}>✕</Text>
        </Pressable>
        {isRecording && (
          <View style={styles.timerRow}>
            <View style={styles.recDot} />
            <Text style={styles.timerTxt}>{mm}:{ss}</Text>
          </View>
        )}
      </SafeAreaView>

      {/* 하단: 녹화 버튼 */}
      <View style={styles.bottomBar}>
        {isRecording && elapsed < MIN_SECS && (
          <Text style={styles.minHint}>{MIN_SECS - elapsed}초 더 녹화하면 저장돼요</Text>
        )}
        <Pressable onPress={handleRecord} style={styles.outerRing}>
          <View style={[styles.innerCircle, isRecording && styles.stopSquare]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#000' },
  root: { flex: 1, backgroundColor: '#000' },

  // 권한
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

  // 카메라 오버레이
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 15, color: '#fff', fontWeight: '500' },
  timerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6, gap: 6,
  },
  recDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b30',
  },
  timerTxt: { fontSize: 16, fontWeight: '600', color: '#fff' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: 56, gap: 16,
  },
  minHint: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  outerRing: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff',
  },
  stopSquare: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#ff3b30',
  },
});
