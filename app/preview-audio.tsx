import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { AppText, Button, Card, ScreenBackground } from '@/components/ui';
import { saveCapturedEntry } from '@/services/saveCapturedEntry';
import { colors, iconSize, radius, spacing } from '@/theme';

export default function PreviewAudioScreen() {
  const db = useSQLiteContext();
  const { uri, durationMs, recordedAt } = useLocalSearchParams<{
    uri: string; durationMs: string; recordedAt: string;
  }>();

  const [hint, setHint] = useState(false);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

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
        durationMs: Number(durationMs) || 0,
        mode: 'audio',
        hint,
        note,
      });

      router.replace('/(tabs)/today');
    } catch (e) {
      console.error('[preview-audio] save failed', e);
      if (mountedRef.current) {
        Alert.alert('저장 실패', '다시 시도해 주세요.');
        setIsSaving(false);
      }
    }
  }, [isSaving, uri, durationMs, recordedAt, hint, note, db]);

  const togglePlay = useCallback(() => {
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing]);

  const fmtSecs = (secs: number) => {
    const s = Math.floor(secs);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScreenBackground edges={['top', 'bottom']}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} disabled={isSaving} hitSlop={spacing.lg}>
            <AppText preset="bodyLarge" color={colors.text.link} style={isSaving ? styles.dimmed : undefined}>취소</AppText>
          </Pressable>
          <AppText preset="titleMedium">미리듣기</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {/* 오디오 플레이어 */}
          <Card raised style={styles.playerBlock}>
            <Pressable onPress={togglePlay} style={styles.playBtn}>
              <Ionicons name={status.playing ? 'pause' : 'play'} size={28} color={colors.brand.onPrimary} />
            </Pressable>
            <View style={styles.playerInfo}>
              <AppText preset="titleMedium">
                {fmtSecs(status.currentTime)} / {fmtSecs(status.duration || Number(durationMs) / 1000)}
              </AppText>
              <AppText preset="caption" color={colors.text.tertiary}>녹음 미리듣기</AppText>
            </View>
          </Card>

          {/* 중요 결정 힌트 (ADR-006) */}
          <Pressable style={styles.checkRow} onPress={() => setHint((h) => !h)}>
            <View style={[styles.checkbox, hint && styles.checkboxOn]}>
              {hint && <Ionicons name="checkmark" size={iconSize.sm} color={colors.brand.onPrimary} />}
            </View>
            <AppText preset="bodyLarge">중요 결정 포함</AppText>
          </Pressable>

          {/* 메모 */}
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
        </ScrollView>

        <View style={styles.bottomBar}>
          <Button label="저장하기 ✎" onPress={handleSave} disabled={isSaving} fullWidth />
        </View>
      </ScreenBackground>

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

  playerBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  playBtn: {
    width: 60, height: 60, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  playerInfo: { gap: spacing.xs },

  label: { marginTop: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  checkbox: {
    width: 24, height: 24, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border.card,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
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
