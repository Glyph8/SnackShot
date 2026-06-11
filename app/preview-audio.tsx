import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { enqueueJob, insertEntry, setUserDecisionHint, updateCompressionResult, updateManualNote } from '@/db';
import { kickWorker } from '@/services/jobs/queue';
import { newId } from '@/lib/id';
import { buildAudioEntryPaths, ensureEntryDir } from '@/lib/storage';

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
      const entryId = newId();
      const recAt = Number(recordedAt);
      const paths = buildAudioEntryPaths(entryId, recAt);

      ensureEntryDir(entryId, recAt);
      new File(uri).move(new File(paths.originalPath));

      const entry = await insertEntry(db, {
        recordedAt: recAt,
        originalPath: paths.originalPath,
        durationMs: Number(durationMs) || 0,
        mode: 'audio',
      });

      // 오디오는 영상 압축 없음 → skipped
      await updateCompressionResult(db, entry.id, 'skipped');

      if (hint) await setUserDecisionHint(db, entry.id, true);
      if (note.trim()) await updateManualNote(db, entry.id, note.trim());

      // STT는 항상 큐잉 (오디오 녹음의 목적은 음성 기록)
      await enqueueJob(db, 'stt', entry.id, 'entries');
      kickWorker(); // 5초 폴링 대기 없이 즉시 1틱

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
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, status.playing]);

  const fmtSecs = (secs: number) => {
    const s = Math.floor(secs);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <SafeAreaView style={styles.safe}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} disabled={isSaving} hitSlop={16}>
            <Text style={[styles.cancelTxt, isSaving && styles.dimmed]}>취소</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
          {/* 오디오 플레이어 */}
          <View style={styles.playerBlock}>
            <Pressable onPress={togglePlay} style={styles.playBtn}>
              <Text style={styles.playBtnIcon}>{status.playing ? '⏸' : '▶'}</Text>
            </Pressable>
            <View style={styles.playerInfo}>
              <Text style={styles.playerTime}>
                {fmtSecs(status.currentTime)} / {fmtSecs(status.duration || Number(durationMs) / 1000)}
              </Text>
              <Text style={styles.playerLabel}>녹음 미리듣기</Text>
            </View>
          </View>

          <View style={styles.form}>
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
  cancelTxt: { fontSize: 16, color: '#888' },
  dimmed: { opacity: 0.4 },
  scroll: { flex: 1 },

  playerBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    paddingHorizontal: 24, paddingVertical: 36,
    backgroundColor: '#0a0a0a',
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnIcon: { fontSize: 26, color: '#000' },
  playerInfo: { gap: 4 },
  playerTime: { fontSize: 20, color: '#fff', fontWeight: '600', fontVariant: ['tabular-nums'] },
  playerLabel: { fontSize: 13, color: '#666' },

  form: { padding: 20, gap: 14 },
  label: {
    fontSize: 12, color: '#666', fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
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

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  overlayTxt: { fontSize: 15, color: '#fff', fontWeight: '500' },
});
