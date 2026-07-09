import { CameraView, type CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureHandlerRootView, PinchGestureHandler, State,
  type PinchGestureHandlerGestureEvent, type PinchGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Icon, Pulse } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { nowMs } from '@/lib/time';
import { colors, iconSize, radius, spacing } from '@/theme';
import * as MediaLibrary from 'expo-media-library';

import { DeviceGalleryModal } from '@/components/camera/DeviceGalleryModal';
import { GalleryButton } from '@/components/camera/GalleryButton';

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
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [canPause, setCanPause] = useState(false); // toggleRecordingAsync 지원 여부(iOS 18+/Android)

  // 촬영 모드 — 사진/영상 토글(v18). 후속확인 "영상으로" 진입(decisionId) 시 영상 우선.
  const [captureMode, setCaptureMode] = useState<'picture' | 'video'>(decisionId ? 'video' : 'picture');
  const [takingPhoto, setTakingPhoto] = useState(false);

  // 갤러리 — 휴대폰 사진 라이브러리를 인앱으로(최근 썸네일 + 그리드/뷰어).
  const [libPermission, requestLibPermission] = MediaLibrary.usePermissions();
  const [latestPhotoUri, setLatestPhotoUri] = useState<string | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
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

  // 최근 사진 썸네일 로드 (권한 허용 시). 갤러리 닫을 때도 갱신한다.
  const refreshLatestPhoto = useCallback(async () => {
    if (!libPermission?.granted) return;
    try {
      const opts: MediaLibrary.AssetsOptions = {
        first: 1,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        mediaType: MediaLibrary.MediaType.photo,
      };
      const res = await MediaLibrary.getAssetsAsync(opts);
      setLatestPhotoUri(res.assets[0]?.uri ?? null);
    } catch (e) {
      console.warn('[record] latest photo load failed', e);
    }
  }, [libPermission?.granted]);

  useEffect(() => { void refreshLatestPhoto(); }, [refreshLatestPhoto]);

  const handleRecord = useCallback(async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      cameraRef.current.stopRecording();
      return;
    }

    // 영상 녹화엔 마이크 권한 필요 — 없으면 요청, 거부 시 안내 후 중단(사진은 권한 없이 가능).
    if (!micPermission?.granted) {
      const res = micPermission?.canAskAgain ? await requestMicPermission() : null;
      if (!res?.granted) {
        Alert.alert('마이크 권한 필요', '영상 녹화에는 마이크 권한이 필요해요. 사진은 권한 없이 촬영할 수 있어요.');
        return;
      }
    }

    cancelledRef.current = false;
    elapsedRef.current = 0;
    pausedRef.current = false;
    recordStartRef.current = nowMs();
    setElapsed(0);
    setPaused(false);
    setIsRecording(true);
    haptics.impact();
    // 일시정지 지원 여부 — 미지원(예: iOS 18 미만)이면 일시정지 버튼을 숨긴다.
    setCanPause(cameraRef.current.getSupportedFeatures().toggleRecordingAsyncAvailable);

    // 누적 타이머 — 일시정지 중엔 정지(ADR-005 Rev). 상한 도달 시 stopRecording으로 강제 종료.
    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= MAX_SECS) cameraRef.current?.stopRecording();
    }, 1000);

    try {
      // 상한은 누적 타이머가 stopRecording으로 강제하므로 maxDuration 미지정(일시정지 시간 제외).
      const result = await cameraRef.current.recordAsync();

      if (cancelledRef.current) return;
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
    } catch (e) {
      // 네이티브 녹화 실패(예: 에뮬레이터 가상 카메라는 녹화 미지원) — 크래시 대신 안내.
      console.error('[record] recordAsync failed', e);
      if (!cancelledRef.current) {
        Alert.alert(
          '녹화 실패',
          '영상 녹화에 실패했어요. 다시 시도해 주세요.\n(에뮬레이터에서는 영상 녹화가 지원되지 않을 수 있어요 — 실제 기기에서 확인해 주세요.)',
        );
      }
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      pausedRef.current = false;
      setPaused(false);
      setIsRecording(false);
    }
  }, [isRecording, decisionId, micPermission, requestMicPermission]);

  // 사진 촬영(v18) — takePictureAsync → preview로 넘긴다(kind=photo, duration 없음).
  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current || takingPhoto) return;
    setTakingPhoto(true);
    haptics.impact();
    const takenAt = nowMs();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (cancelledRef.current || !photo?.uri) return;
      router.replace({
        pathname: '/preview',
        params: {
          uri: photo.uri,
          kind: 'photo',
          recordedAt: String(takenAt),
          ...(decisionId ? { decisionId } : {}),
        },
      });
    } catch (e) {
      console.error('[record] takePicture failed', e);
      if (!cancelledRef.current) Alert.alert('사진 촬영 실패', '다시 시도해 주세요.');
    } finally {
      setTakingPhoto(false);
    }
  }, [takingPhoto, decisionId]);

  // 셔터 — 모드에 따라 사진/영상 분기.
  const handleShutter = useCallback(() => {
    if (captureMode === 'picture') void handleTakePhoto();
    else void handleRecord();
  }, [captureMode, handleTakePhoto, handleRecord]);

  // 갤러리 열기 — 권한 없으면 요청 후 연다.
  const handleOpenGallery = useCallback(async () => {
    let granted = libPermission?.granted ?? false;
    if (!granted) {
      const res = await requestLibPermission();
      granted = res.granted;
    }
    if (granted) {
      await refreshLatestPhoto();
      setGalleryVisible(true);
    } else {
      Alert.alert('사진 접근 권한 필요', '갤러리를 보려면 사진 접근을 허용해 주세요.');
    }
  }, [libPermission, requestLibPermission, refreshLatestPhoto]);

  // 영상 일시정지↔재개 (단일 토글). 활성 녹화가 있을 때만 효과.
  const togglePause = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || !isRecording) return;
    try {
      await cam.toggleRecordingAsync();
      pausedRef.current = !pausedRef.current;
      setPaused(pausedRef.current);
      haptics.tap();
    } catch (e) {
      console.error('[record] toggleRecording failed', e);
    }
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

  // ── 권한 거부 (카메라 필수. 마이크는 영상 녹화 시에만 요청) ──
  if (!cameraPermission.granted) {
    const canAsk = cameraPermission.canAskAgain;
    return (
      <SafeAreaView style={styles.permission}>
        <AppText preset="titleMedium" color={colors.text.onMedia} style={styles.permTitle}>
          카메라 접근을{'\n'}허용해 주세요
        </AppText>
        <AppText preset="bodyMedium" color={colors.text.onMediaMuted} style={styles.permDesc}>
          사진·영상을 촬영하려면{'\n'}카메라 권한이 필요해요.
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
            mode={captureMode}
            videoQuality="720p"
          />
        </View>
      </PinchGestureHandler>

      {/* 상단: 닫기 + 타이머 + 전/후면 전환 */}
      <SafeAreaView style={styles.topBar}>
        <Pressable hitSlop={spacing.lg} onPress={handleClose} style={styles.chip}>
          <Icon name="close" size={iconSize.md} color={colors.text.onMedia} />
        </Pressable>
        {isRecording && (
          <View style={styles.timerRow}>
            <Pulse active={!paused}>
              <View style={[styles.recDot, paused && styles.recDotPaused]} />
            </Pulse>
            <AppText preset="button" color={colors.text.onMedia}>{paused ? '일시정지' : `${mm}:${ss}`}</AppText>
          </View>
        )}
        <Pressable hitSlop={spacing.lg} onPress={toggleFacing} disabled={isRecording} style={[styles.chip, isRecording && styles.chipDisabled]}>
          <Icon name="flip" size={iconSize.md} color={colors.text.onMedia} />
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

      {/* 갤러리 진입 — 좌하단(녹화 중엔 숨김) */}
      {!isRecording && (
        <View style={styles.galleryCorner} pointerEvents="box-none">
          <GalleryButton latestUri={latestPhotoUri} onPress={handleOpenGallery} />
        </View>
      )}

      {/* 녹화 버튼 — 세로: 하단 중앙 / 가로: 오른쪽 중앙 */}
      <View style={landscape ? styles.recordBarLandscape : styles.recordBar}>
        {isRecording && elapsed < MIN_SECS && (
          <AppText preset="caption" color={colors.text.onMediaMuted}>{MIN_SECS - elapsed}초 더 녹화하면 저장돼요</AppText>
        )}
        {isRecording && canPause && (
          <Pressable onPress={togglePause} style={styles.pauseBtn} accessibilityLabel={paused ? '재개' : '일시정지'}>
            <Icon name={paused ? 'play' : 'pause'} size={iconSize.md} color={colors.text.onMedia} />
            <AppText preset="caption" color={colors.text.onMedia}>{paused ? '재개' : '일시정지'}</AppText>
          </Pressable>
        )}
        {!isRecording && (
          <View style={styles.modeToggle}>
            {(['picture', 'video'] as const).map((m) => {
              const on = captureMode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setCaptureMode(m)}
                  hitSlop={spacing.sm}
                  style={[styles.modeChip, on && styles.modeChipOn]}
                >
                  <AppText preset="button" color={on ? colors.text.primary : colors.text.onMediaMuted}>
                    {m === 'picture' ? '사진' : '영상'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
        <Pressable onPress={handleShutter} disabled={takingPhoto} style={styles.outerRing}>
          <View style={[styles.innerCircle, isRecording && styles.stopSquare]} />
        </Pressable>
      </View>

      <DeviceGalleryModal
        visible={galleryVisible}
        onClose={() => { setGalleryVisible(false); void refreshLatestPhoto(); }}
      />
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
  recDotPaused: { backgroundColor: colors.text.onMediaMuted },
  pauseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.media.controlScrim, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },

  galleryCorner: {
    position: 'absolute', left: spacing.xl, bottom: spacing['5xl'],
  },
  recordBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: spacing['5xl'], gap: spacing.lg,
  },
  recordBarLandscape: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingRight: spacing['4xl'], gap: spacing.lg,
  },
  modeToggle: {
    flexDirection: 'row', gap: spacing.xs,
    backgroundColor: colors.media.controlScrim, borderRadius: radius.pill, padding: spacing.xs,
  },
  modeChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: radius.pill },
  modeChipOn: { backgroundColor: colors.text.onMedia },
  outerRing: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: colors.text.onMedia,
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.text.onMedia },
  stopSquare: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.media.recordDot },
});
