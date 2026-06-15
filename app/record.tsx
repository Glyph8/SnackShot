import { Ionicons } from '@expo/vector-icons';
import { CameraView, type CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  GestureHandlerRootView, PinchGestureHandler, State,
  type PinchGestureHandlerGestureEvent, type PinchGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { nowMs } from '@/lib/time';
import { colors, iconSize, radius, spacing } from '@/theme';

const MAX_SECS = 180; // ADR-005: 3분 상한
const MIN_SECS = 3;   // 3초 미만은 저장하지 않음
const ZOOM_SENSITIVITY = 0.4;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export default function RecordScreen() {
  // FollowUpCard에서 "영상으로" 진입 시 decisionId가 전달됨 — preview로 pass-through
  const { decisionId } = useLocalSearchParams<{ decisionId?: string }>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [zoom, setZoom] = useState(0);
  const baseZoomRef = useRef(0);
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
        ...(decisionId ? { decisionId } : {}),
      },
    });
  }, [isRecording]);

  const handleClose = useCallback(() => {
    cancelledRef.current = true;
    if (isRecording) cameraRef.current?.stopRecording();
    router.back();
  }, [isRecording]);

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  // 핀치 줌 — base 줌에 스케일 변화량을 더해 0~1로 클램프
  const onPinch = useCallback((e: PinchGestureHandlerGestureEvent) => {
    setZoom(clamp(baseZoomRef.current + (e.nativeEvent.scale - 1) * ZOOM_SENSITIVITY));
  }, []);
  const onPinchState = useCallback((e: PinchGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      baseZoomRef.current = clamp(baseZoomRef.current + (e.nativeEvent.scale - 1) * ZOOM_SENSITIVITY);
    }
  }, []);

  // ── 권한 로딩 중 ──
  if (!cameraPermission || !micPermission) {
    return <View style={styles.loading} />;
  }

  // ── 권한 거부 ──
  if (!cameraPermission.granted || !micPermission.granted) {
    const canAsk = cameraPermission.canAskAgain || micPermission.canAskAgain;
    return (
      <SafeAreaView style={styles.permission}>
        <AppText preset="titleMedium" color={colors.text.onMedia} style={styles.permTitle}>
          카메라와 마이크{'\n'}접근을 허용해 주세요
        </AppText>
        <AppText preset="bodyMedium" color={colors.text.onMediaMuted} style={styles.permDesc}>
          스냅샷을 녹화하려면{'\n'}두 가지 권한이 모두 필요해요.
        </AppText>
        <Button
          label={canAsk ? '권한 허용하기' : '설정에서 허용하기 →'}
          onPress={async () => {
            if (!canAsk) { Linking.openSettings(); return; }
            if (!cameraPermission.granted && cameraPermission.canAskAgain) await requestCameraPermission();
            if (!micPermission.granted && micPermission.canAskAgain) await requestMicPermission();
          }}
          style={styles.permBtn}
        />
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <AppText preset="bodyMedium" color={colors.text.onMediaMuted}>돌아가기</AppText>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── 카운트다운 (남은 시간) ──
  const remaining = MAX_SECS - elapsed;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  const zoomPct = Math.round(zoom * 100);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* 핀치로 확대/축소 */}
      <PinchGestureHandler onGestureEvent={onPinch} onHandlerStateChange={onPinchState}>
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            zoom={zoom}
            mode="video"
            videoQuality="720p"
          />
        </View>
      </PinchGestureHandler>

      {/* 상단: 닫기 + 타이머 + 전/후면 전환 */}
      <SafeAreaView style={styles.topBar}>
        <Pressable hitSlop={spacing.lg} onPress={handleClose} style={styles.chip}>
          <Ionicons name="close" size={iconSize.md} color={colors.text.onMedia} />
        </Pressable>
        {isRecording && (
          <View style={styles.timerRow}>
            <View style={styles.recDot} />
            <AppText preset="button" color={colors.text.onMedia}>{mm}:{ss}</AppText>
          </View>
        )}
        <Pressable hitSlop={spacing.lg} onPress={toggleFacing} disabled={isRecording} style={[styles.chip, isRecording && styles.chipDisabled]}>
          <Ionicons name="camera-reverse" size={iconSize.md} color={colors.text.onMedia} />
        </Pressable>
      </SafeAreaView>

      {/* 줌 표시 */}
      {zoomPct > 0 && (
        <View style={styles.zoomBadgeWrap} pointerEvents="none">
          <View style={styles.zoomBadge}>
            <AppText preset="caption" color={colors.text.onMedia}>{`${zoomPct}%`}</AppText>
          </View>
        </View>
      )}

      {/* 하단: 녹화 버튼 */}
      <View style={styles.bottomBar}>
        {isRecording && elapsed < MIN_SECS && (
          <AppText preset="caption" color={colors.text.onMediaMuted}>{MIN_SECS - elapsed}초 더 녹화하면 저장돼요</AppText>
        )}
        <Pressable onPress={handleRecord} style={styles.outerRing}>
          <View style={[styles.innerCircle, isRecording && styles.stopSquare]} />
        </Pressable>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.media.cameraBg },
  root: { flex: 1, backgroundColor: colors.media.cameraBg },

  permission: {
    flex: 1, backgroundColor: colors.media.cameraBg,
    alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'],
  },
  permTitle: { textAlign: 'center', marginBottom: spacing.md },
  permDesc: { textAlign: 'center', marginBottom: spacing['4xl'] },
  permBtn: { marginBottom: spacing.md },
  backBtn: { paddingVertical: spacing.sm },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm,
  },
  chip: {
    width: 38, height: 38, borderRadius: radius.pill,
    backgroundColor: colors.media.controlScrim,
    alignItems: 'center', justifyContent: 'center',
  },
  chipDisabled: { opacity: 0.4 },
  zoomBadgeWrap: { position: 'absolute', top: 88, left: 0, right: 0, alignItems: 'center' },
  zoomBadge: {
    backgroundColor: colors.media.controlScrim, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  timerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.media.controlScrim, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.xs,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.media.recordDot },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: spacing['5xl'], gap: spacing.lg,
  },
  outerRing: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: colors.text.onMedia,
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.text.onMedia },
  stopSquare: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.media.recordDot },
});
