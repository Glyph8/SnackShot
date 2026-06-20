import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelMeter } from '@/components/capture/LevelMeter';
import { AppText, Button, Icon } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { nowMs } from '@/lib/time';
import { colors, iconSize, radius, spacing } from '@/theme';

const MAX_SECS = 180;
const MIN_SECS = 3;

export default function RecordAudioScreen() {
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);

  // 레벨미터를 위해 metering 활성화. 상태 폴링은 부드러운 바를 위해 100ms.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 100);

  // 세션 상태로 일시정지/이어찍기를 다룬다(ADR-005 Rev). recState.isRecording은
  // 일시정지 시 false가 될 수 있어 UI/가드의 단일 기준으로 쓰지 않는다.
  const [session, setSession] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0); // 누적 녹화 시간(일시정지 제외)
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

  useEffect(() => () => { cancelledRef.current = true; }, []);

  const startRecording = useCallback(async () => {
    if (preparingRef.current || session !== 'idle') return;
    preparingRef.current = true;
    cancelledRef.current = false;
    recordStartRef.current = nowMs();
    elapsedRef.current = 0;
    setElapsedMs(0);
    await recorder.prepareToRecordAsync();
    if (!cancelledRef.current) {
      recorder.record();
      setSession('recording');
      haptics.impact();
    }
    preparingRef.current = false;
  }, [recorder, session]);

  const stopAndSave = useCallback(async () => {
    if (session === 'idle') return;
    const startMs = recordStartRef.current;
    const durationMs = elapsedRef.current; // 누적 기준(ADR-005 Rev)
    await recorder.stop();
    setSession('idle');
    if (cancelledRef.current) return;

    const uri = recorder.uri;
    if (!uri) return;
    if (durationMs < MIN_SECS * 1000) {
      Alert.alert('너무 짧아요', `${MIN_SECS}초 이상 녹음해야 저장됩니다.`);
      return;
    }
    router.replace({
      pathname: '/preview-audio',
      params: { uri, durationMs: String(durationMs), recordedAt: String(startMs) },
    });
  }, [recorder, session]);

  // 누적 타이머 — 녹음 중에만 진행(일시정지 시 정지). 상한 도달 시 자동 저장.
  useEffect(() => {
    if (session !== 'recording') return;
    const id = setInterval(() => {
      elapsedRef.current += 250;
      setElapsedMs(elapsedRef.current);
      if (elapsedRef.current >= MAX_SECS * 1000) stopAndSave();
    }, 250);
    return () => clearInterval(id);
  }, [session, stopAndSave]);

  const togglePause = useCallback(() => {
    if (session === 'recording') { recorder.pause(); setSession('paused'); haptics.tap(); }
    else if (session === 'paused') { recorder.record(); setSession('recording'); haptics.tap(); }
  }, [recorder, session]);

  const handleClose = useCallback(async () => {
    cancelledRef.current = true;
    if (session !== 'idle') await recorder.stop();
    router.back();
  }, [recorder, session]);

  if (permGranted === null) return <View style={styles.loading} />;

  if (!permGranted) {
    return (
      <SafeAreaView style={styles.permission}>
        <AppText preset="titleMedium" color={colors.text.onMedia} style={styles.permTitle}>
          마이크{'\n'}접근을 허용해 주세요
        </AppText>
        <AppText preset="bodyMedium" color={colors.text.onMediaMuted} style={styles.permDesc}>
          음성을 녹음하려면{'\n'}마이크 권한이 필요해요.
        </AppText>
        <Button
          label={canAskAgain ? '권한 허용하기' : '설정에서 허용하기 →'}
          onPress={async () => {
            if (!canAskAgain) { Linking.openSettings(); return; }
            const res = await requestRecordingPermissionsAsync();
            setPermGranted(res.granted);
            setCanAskAgain(res.canAskAgain);
          }}
          style={styles.permBtn}
        />
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <AppText preset="bodyMedium" color={colors.text.onMediaMuted}>돌아가기</AppText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const elapsed = Math.floor(elapsedMs / 1000);
  const remaining = Math.max(0, MAX_SECS - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const recording = session !== 'idle';

  return (
    <SafeAreaView style={styles.root}>
      {/* 상단: 닫기 + 타이머 */}
      <View style={styles.topBar}>
        <Pressable hitSlop={spacing.lg} onPress={handleClose} style={styles.chip}>
          <Icon name="close" size={iconSize.md} color={colors.text.onMedia} />
        </Pressable>
        {recording && (
          <View style={styles.timerRow}>
            <View style={[styles.recDot, session === 'paused' && styles.recDotPaused]} />
            <AppText preset="button" color={colors.text.onMedia}>{mm}:{ss}</AppText>
          </View>
        )}
      </View>

      {/* 중앙: 상태 표시 */}
      <View style={styles.center}>
        <View style={styles.micWrap}>
          <Icon name="mic" size={44} active color={colors.text.onMedia} />
        </View>
        {recording && <LevelMeter db={recState.metering} active={session === 'recording'} />}
        <AppText preset="bodyLarge" color={colors.text.onMediaMuted}>
          {session === 'paused' ? '일시정지됨' : session === 'recording' ? '녹음 중…' : '버튼을 눌러 녹음 시작'}
        </AppText>
        {recording && elapsed < MIN_SECS && (
          <AppText preset="caption" color={colors.text.onMediaMuted}>{MIN_SECS - elapsed}초 더 녹음하면 저장돼요</AppText>
        )}
      </View>

      {/* 하단: 녹음 버튼 */}
      <View style={styles.bottomBar}>
        {!recording ? (
          <Pressable onPress={startRecording} style={styles.outerRing} accessibilityLabel="녹음 시작">
            <View style={styles.innerCircle} />
          </Pressable>
        ) : (
          <View style={styles.controlsRow}>
            <Pressable onPress={togglePause} style={styles.sideBtn} accessibilityLabel={session === 'paused' ? '재개' : '일시정지'}>
              <Icon name={session === 'paused' ? 'play' : 'pause'} size={iconSize.lg} color={colors.text.onMedia} />
              <AppText preset="caption" color={colors.text.onMediaMuted}>{session === 'paused' ? '재개' : '일시정지'}</AppText>
            </Pressable>
            <Pressable onPress={stopAndSave} style={styles.outerRing} accessibilityLabel="정지 후 저장">
              <View style={styles.stopSquare} />
            </Pressable>
            <View style={styles.sideBtn} />
          </View>
        )}
      </View>
    </SafeAreaView>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
  },
  chip: {
    width: 38, height: 38, borderRadius: radius.pill,
    backgroundColor: colors.media.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.media.surfaceTint, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.xs,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.media.recordDot },
  recDotPaused: { backgroundColor: colors.text.onMediaMuted },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  micWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.media.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
  },

  bottomBar: { alignItems: 'center', paddingBottom: spacing['5xl'] },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing['3xl'] },
  sideBtn: { width: 64, alignItems: 'center', gap: spacing.xs },
  outerRing: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: colors.text.onMedia,
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.text.onMedia },
  stopSquare: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.media.recordDot },
});
