import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { DecisionHintCard } from '@/components/capture/DecisionHintCard';
import { AppText, Button, CollapsibleSection, ScreenBackground } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { saveCapturedEntry } from '@/services/saveCapturedEntry';
import { colors, radius, spacing } from '@/theme';
import type { EntryMode } from '@/types/domain';

export default function PreviewScreen() {
  const db = useSQLiteContext();
  const { uri, durationMs, recordedAt, decisionId, kind } = useLocalSearchParams<{
    uri: string; durationMs: string; recordedAt: string; decisionId?: string; kind?: string;
  }>();
  const isPhoto = kind === 'photo';

  const [mode, setMode] = useState<EntryMode>(isPhoto ? 'photo' : 'voice');
  const [hint, setHint] = useState(false);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // 파일 업로드 경로에서는 durationMs=0으로 진입 — player가 로드된 뒤 실제 값으로 보완
  const [resolvedDurationMs, setResolvedDurationMs] = useState(Number(durationMs) || 0);

  // 자동 재생 + 루프
  // 사진은 영상 플레이어를 만들지 않는다(source=null). 영상만 로드·재생.
  const player = useVideoPlayer(isPhoto ? null : uri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (isPhoto || Number(durationMs) > 0) return; // 사진/녹화 경로는 duration 계산 불필요
    let attempts = 0;
    const timerId = setInterval(() => {
      if (player.duration > 0) {
        if (mountedRef.current) setResolvedDurationMs(Math.round(player.duration * 1000));
        clearInterval(timerId);
      } else if (++attempts >= 50) { // 10s 이내 미해결 시 포기
        clearInterval(timerId);
      }
    }, 200);
    return () => clearInterval(timerId);
  }, [player, durationMs]);

  // 저장 중 취소 금지 — 파일 이동 완료 전 삭제 시 원본 소실
  const handleCancel = useCallback(() => {
    if (isSaving) return;
    const file = new File(uri);
    if (file.exists) file.delete();
    router.back();
  }, [isSaving, uri]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveCapturedEntry(db, {
        uri,
        recordedAt: Number(recordedAt),
        durationMs: isPhoto ? 0 : resolvedDurationMs,
        mode,
        hint,
        note,
        decisionId,
      });

      haptics.success();
      router.replace('/(tabs)/today');
    } catch (e) {
      console.error('[preview] save failed', e);
      if (mountedRef.current) {
        Alert.alert('저장 실패', '다시 시도해 주세요.');
        setIsSaving(false);
      }
    }
  }, [isSaving, uri, resolvedDurationMs, recordedAt, mode, hint, note, db, decisionId]);

  return (
    <KeyboardAvoidingView
      // Android edge-to-edge에서는 adjustResize가 무력화되므로 padding으로 메모 입력창을 키보드 위로 올린다
      behavior="padding"
      style={styles.root}
    >
      <ScreenBackground edges={['top', 'bottom']}>
        {/* 헤더 — 취소 / 미리보기 */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} disabled={isSaving} hitSlop={spacing.lg}>
            <AppText preset="bodyLarge" color={colors.text.link} style={isSaving ? styles.dimmed : undefined}>취소</AppText>
          </Pressable>
          <AppText preset="titleMedium">미리보기</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {/* 미리보기 — 사진: 이미지 / 영상: 플레이어 */}
          <View style={styles.videoFrame}>
            {isPhoto ? (
              <Image source={{ uri }} style={styles.video} resizeMode="contain" />
            ) : (
              <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
            )}
          </View>

          {/* 중요 결정 — 상단 강조(켜면 결정 추출). ADR-006 */}
          <DecisionHintCard value={hint} onToggle={() => setHint((h) => !h)} />

          {/* 세부 설정 — 기본 접힘으로 '바로 저장' 마찰을 줄인다 */}
          <CollapsibleSection title="세부 설정" hint={isPhoto ? '사진' : mode === 'voice' ? '말하며 기록' : '소리 없이'}>
            {!isPhoto && (
              <>
                <AppText preset="caption" color={colors.text.secondary} style={styles.label}>기록 방식</AppText>
                <View style={styles.modeRow}>
                  {(['voice', 'silent'] as EntryMode[]).map((m) => {
                    const on = mode === m;
                    return (
                      <Pressable key={m} style={[styles.modeBtn, on && styles.modeBtnOn]} onPress={() => setMode(m)}>
                        <AppText preset="button" color={on ? colors.brand.onPrimary : colors.text.secondary}>
                          {m === 'voice' ? '말하며 기록' : '소리 없이'}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <AppText preset="caption" color={colors.text.tertiary} style={styles.modeHint}>
                  {mode === 'voice' ? '음성을 글로 변환해요 (STT).' : '변환 없이 영상만 저장돼요.'}
                </AppText>
              </>
            )}

            <AppText preset="caption" color={colors.text.secondary} style={styles.label}>메모</AppText>
            <TextInput
              style={styles.noteInput}
              placeholder="선택 사항"
              placeholderTextColor={colors.text.tertiary}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
            />
          </CollapsibleSection>
        </ScrollView>

        {/* 하단 저장 버튼 */}
        <View style={styles.bottomBar}>
          <Button label="저장하기 ✎" onPress={handleSave} disabled={isSaving} fullWidth />
        </View>
      </ScreenBackground>

      {/* 저장 중 전체 화면 오버레이 */}
      {isSaving && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.text.onMedia} />
          <AppText preset="bodyMedium" color={colors.text.onMedia}>저장 중…</AppText>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerSpacer: { width: 40 },
  dimmed: { opacity: 0.4 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },

  videoFrame: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.lg, padding: spacing.sm,
    marginTop: spacing.sm,
  },
  video: {
    width: '100%', height: 280, borderRadius: radius.md,
    backgroundColor: colors.media.thumbSlate,
  },

  label: { marginTop: spacing.sm },
  modeRow: { flexDirection: 'row', gap: spacing.md },
  modeBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surface.paper, borderWidth: 1, borderColor: colors.border.card,
    alignItems: 'center',
  },
  modeBtnOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  modeHint: { marginTop: spacing.xs },

  noteInput: {
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    color: colors.text.primary, fontSize: 15, padding: spacing.md,
    minHeight: 88, textAlignVertical: 'top',
  },

  bottomBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlayScrim,
    alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
  },
});
