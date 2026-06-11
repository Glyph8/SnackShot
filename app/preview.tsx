import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { enqueueJob, insertEntry, setUserDecisionHint, updateManualNote } from '@/db';
import { kickWorker } from '@/services/jobs/queue';
import { newId } from '@/lib/id';
import { buildEntryPaths, ensureEntryDir } from '@/lib/storage';
import type { EntryMode } from '@/types/domain';

export default function PreviewScreen() {
  const db = useSQLiteContext();
  const { uri, durationMs, recordedAt } = useLocalSearchParams<{
    uri: string; durationMs: string; recordedAt: string;
  }>();

  const [mode, setMode] = useState<EntryMode>('voice');
  const [hint, setHint] = useState(false);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // 파일 업로드 경로에서는 durationMs=0으로 진입 — player가 로드된 뒤 실제 값으로 보완
  const [resolvedDurationMs, setResolvedDurationMs] = useState(Number(durationMs) || 0);

  // 자동 재생 + 루프
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (Number(durationMs) > 0) return; // 녹화 경로는 이미 정확한 값 있음
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
      const entryId = newId();
      const recAt = Number(recordedAt);
      const paths = buildEntryPaths(entryId, recAt);

      // 녹화 캐시 → entries 디렉토리로 이동
      ensureEntryDir(entryId, recAt);
      new File(uri).move(new File(paths.originalPath));

      const entry = await insertEntry(db, {
        recordedAt: recAt,
        originalPath: paths.originalPath,
        durationMs: resolvedDurationMs,
        mode,
      });

      if (hint) await setUserDecisionHint(db, entry.id, true);
      if (note.trim()) await updateManualNote(db, entry.id, note.trim());

      // 백그라운드 잡 큐잉 (ADR-012)
      await enqueueJob(db, 'compression', entry.id, 'entries');
      if (mode === 'voice') await enqueueJob(db, 'stt', entry.id, 'entries');
      kickWorker(); // 5초 폴링 대기 없이 즉시 1틱

      router.replace('/(tabs)/today');
    } catch (e) {
      console.error('[preview] save failed', e);
      if (mountedRef.current) {
        Alert.alert('저장 실패', '다시 시도해 주세요.');
        setIsSaving(false);
      }
    }
  }, [isSaving, uri, resolvedDurationMs, recordedAt, mode, hint, note, db]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <SafeAreaView style={styles.safe}>
        {/* 헤더 — 취소만 */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} disabled={isSaving} hitSlop={16}>
            <Text style={[styles.cancelTxt, isSaving && styles.dimmed]}>취소</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
          {/* 영상 미리보기 */}
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
          />

          <View style={styles.form}>
            {/* 모드 토글 */}
            <Text style={styles.label}>모드</Text>
            <View style={styles.modeRow}>
              {(['voice', 'silent'] as EntryMode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.modeBtn, mode === m && styles.modeBtnOn]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.modeTxt, mode === m && styles.modeTxtOn]}>
                    {m === 'voice' ? '독백 모드' : '조용 모드'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 중요 결정 힌트 (ADR-006) */}
            <Pressable style={styles.checkRow} onPress={() => setHint((h) => !h)}>
              <View style={[styles.checkbox, hint && styles.checkboxOn]}>
                {hint && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>중요 결정 포함</Text>
            </Pressable>

            {/* 메모 */}
            <Text style={styles.label}>메모</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="선택 사항"
              placeholderTextColor="#555"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
            />
          </View>
        </ScrollView>

        {/* 하단 저장 버튼 — ScrollView 밖, SafeArea 안 */}
        <View style={styles.bottomBar}>
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              isSaving && styles.saveBtnDisabled,
              pressed && !isSaving && styles.saveBtnPressed,
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnTxt}>저장하기</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* 저장 중 전체 화면 오버레이 — 모든 입력 차단 */}
      {isSaving && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayTxt}>저장 중…</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2a',
  },
  scroll: { flex: 1 },
  cancelTxt: { fontSize: 16, color: '#888' },
  dimmed: { opacity: 0.4 },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a2a2a',
  },
  saveBtn: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnPressed: { backgroundColor: '#e0e0e0' },
  saveBtnDisabled: { backgroundColor: '#fff', opacity: 0.35 },
  saveBtnTxt: { fontSize: 17, fontWeight: '600', color: '#000' },
  video: { width: '100%', height: 300, backgroundColor: '#111' },
  form: { padding: 20, gap: 14 },
  label: { fontSize: 12, color: '#666', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#1a1a1a', alignItems: 'center',
  },
  modeBtnOn: { backgroundColor: '#fff' },
  modeTxt: { fontSize: 14, fontWeight: '500', color: '#555' },
  modeTxtOn: { color: '#000' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#3a3a3a',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#fff', borderColor: '#fff' },
  checkmark: { fontSize: 13, fontWeight: '700', color: '#000' },
  checkLabel: { fontSize: 15, color: '#ddd' },
  noteInput: {
    backgroundColor: '#1a1a1a', borderRadius: 10,
    color: '#fff', fontSize: 15, padding: 14,
    minHeight: 88, textAlignVertical: 'top',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  overlayTxt: { fontSize: 15, color: '#fff', fontWeight: '500' },
});
