import { Ionicons } from '@expo/vector-icons';
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
import { AppText, Button } from '@/components/ui';
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

  const elapsed = Math.floor(recState.durationMillis / 1000);
  const remaining = MAX_SECS - elapsed;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <SafeAreaView style={styles.root}>
      {/* 상단: 닫기 + 타이머 */}
      <View style={styles.topBar}>
        <Pressable hitSlop={spacing.lg} onPress={handleClose} style={styles.chip}>
          <Ionicons name="close" size={iconSize.md} color={colors.text.onMedia} />
        </Pressable>
        {recState.isRecording && (
          <View style={styles.timerRow}>
            <View style={styles.recDot} />
            <AppText preset="button" color={colors.text.onMedia}>{mm}:{ss}</AppText>
          </View>
        )}
      </View>

      {/* 중앙: 상태 표시 */}
      <View style={styles.center}>
        <View style={styles.micWrap}>
          <Ionicons name="mic" size={44} color={colors.text.onMedia} />
        </View>
        {recState.isRecording && <LevelMeter db={recState.metering} active={recState.isRecording} />}
        <AppText preset="bodyLarge" color={colors.text.onMediaMuted}>
          {recState.isRecording ? '녹음 중…' : '버튼을 눌러 녹음 시작'}
        </AppText>
        {recState.isRecording && elapsed < MIN_SECS && (
          <AppText preset="caption" color={colors.text.onMediaMuted}>{MIN_SECS - elapsed}초 더 녹음하면 저장돼요</AppText>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  micWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.media.surfaceTint,
    alignItems: 'center', justifyContent: 'center',
  },

  bottomBar: { alignItems: 'center', paddingBottom: spacing['5xl'] },
  outerRing: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: colors.text.onMedia,
    alignItems: 'center', justifyContent: 'center',
  },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.text.onMedia },
  stopSquare: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.media.recordDot },
});
