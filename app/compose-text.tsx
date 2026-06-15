import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, TextInput, View,
} from 'react-native';

import { AppText, ScreenBackground } from '@/components/ui';
import { enqueueJob, getSettings, insertTextEntry } from '@/db';
import { kickWorker } from '@/services/jobs/queue';
import { colors, spacing } from '@/theme';

export default function ComposeTextScreen() {
  const db = useSQLiteContext();
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // 진입 시각을 고정 — 사용자가 길게 쓰는 동안 시간 흐르는 것 방지
  const recordedAtRef = useRef(Date.now());
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const trimmed = body.trim();
  const canSave = trimmed.length > 0 && !isSaving;

  const handleCancel = useCallback(() => {
    if (isSaving) return;
    if (trimmed.length > 0) {
      Alert.alert('작성 취소', '작성 중인 내용이 사라집니다.', [
        { text: '계속 작성', style: 'cancel' },
        { text: '버리기', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }, [isSaving, trimmed]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const entry = await insertTextEntry(db, {
        recordedAt: recordedAtRef.current,
        body: trimmed,
      });

      // label_extraction: silent와 동일하게 manualNote 텍스트가 입력
      await enqueueJob(db, 'label_extraction', entry.id, 'entries');

      // obsidian export: vault 연결 + autoExport일 때만
      const settings = await getSettings(db);
      if (settings.obsidianVaultUri && settings.obsidianAutoExport) {
        await enqueueJob(db, 'obsidian_export', entry.id, 'entries');
      }

      kickWorker();
      router.replace('/(tabs)/today');
    } catch (e) {
      console.error('[compose-text] save failed', e);
      if (mountedRef.current) {
        Alert.alert('저장 실패', '다시 시도해 주세요.');
        setIsSaving(false);
      }
    }
  }, [canSave, db, trimmed]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScreenBackground edges={['top', 'left', 'right', 'bottom']}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} disabled={isSaving} hitSlop={spacing.lg}>
            <AppText preset="bodyLarge" color={colors.text.link} style={isSaving ? styles.dimmed : undefined}>취소</AppText>
          </Pressable>
          <AppText preset="caption" color={colors.text.secondary}>
            {format(new Date(recordedAtRef.current), 'M월 d일 HH:mm', { locale: ko })}
          </AppText>
          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={spacing.lg}>
            <AppText preset="button" color={colors.text.link} style={!canSave ? styles.dimmed : undefined}>저장</AppText>
          </Pressable>
        </View>

        {/* 본문 입력 — 전체 화면 */}
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="지금 떠오른 생각을 적어보세요"
          placeholderTextColor={colors.text.tertiary}
          multiline
          autoFocus
          textAlignVertical="top"
          editable={!isSaving}
        />
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
  dimmed: { opacity: 0.35 },
  input: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlayScrim,
    alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
  },
});
