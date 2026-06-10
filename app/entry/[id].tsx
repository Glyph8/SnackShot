import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Linking, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import {
  getEntry, getLatestTranscript, softDeleteEntry,
  updateEditedText, updateManualNote,
} from '@/db';
import type { Entry, Transcript } from '@/types/domain';

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

type EditTarget = 'transcript' | 'note' | null;

export default function EntryDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');

  const player = useVideoPlayer(
    entry?.compressedPath ?? entry?.originalPath ?? null,
    (p) => { p.loop = false; },
  );

  useEffect(() => {
    (async () => {
      const e = await getEntry(db, id);
      if (!e) { router.back(); return; }
      setEntry(e);
      setTranscript(await getLatestTranscript(db, e.id));
    })();
  }, [db, id]);

  const openEdit = useCallback((target: 'transcript' | 'note') => {
    setEditTarget(target);
    setEditValue(
      target === 'transcript'
        ? (transcript?.editedText ?? transcript?.rawText ?? '')
        : (entry?.manualNote ?? ''),
    );
  }, [transcript, entry]);

  const handleSaveEdit = useCallback(async () => {
    if (!entry || !editTarget) return;
    if (editTarget === 'transcript' && transcript) {
      await updateEditedText(db, transcript.id, editValue);
      setTranscript((t) => t ? { ...t, editedText: editValue } : t);
    } else if (editTarget === 'note') {
      await updateManualNote(db, entry.id, editValue);
      setEntry((e) => e ? { ...e, manualNote: editValue } : e);
    }
    setEditTarget(null);
  }, [db, entry, transcript, editTarget, editValue]);

  const handleDelete = useCallback(() => {
    if (!entry) return;
    Alert.alert('클립 삭제', '이 클립을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await softDeleteEntry(db, entry.id);
          router.back(); // today.tsx useFocusEffect가 목록 재로드
        },
      },
    ]);
  }, [db, entry]);

  const handleMenu = useCallback(() => {
    if (!entry) return;
    Alert.alert('', '', [
      { text: '원본 영상 열기', onPress: () => Linking.openURL(entry.originalPath) },
      { text: '삭제', style: 'destructive', onPress: handleDelete },
      { text: '취소', style: 'cancel' },
    ]);
  }, [entry, handleDelete]);

  if (!entry) return <View style={styles.loading} />;

  const isCompressing = entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';
  const isSTT = entry.aiLabelStatus === 'pending' || entry.aiLabelStatus === 'processing';

  return (
    <SafeAreaView style={styles.root}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {format(new Date(entry.recordedAt), 'M월 d일 HH:mm')}
        </Text>
        <Pressable onPress={handleMenu} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.menuTxt}>⋯</Text>
        </Pressable>
      </View>

      <ScrollView>
        {/* 영상 */}
        <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />

        {/* 메타 뱃지 */}
        <View style={styles.badges}>
          <Text style={styles.badge}>{entry.mode === 'voice' ? '독백' : '조용'}</Text>
          <Text style={styles.badge}>{fmtDuration(entry.durationMs)}</Text>
          {isCompressing && <Text style={[styles.badge, styles.warnBadge]}>압축 중</Text>}
          {isSTT && <Text style={[styles.badge, styles.warnBadge]}>STT 처리 중</Text>}
          {entry.compressionStatus === 'failed' && (
            <Text style={[styles.badge, styles.errBadge]}>압축 실패</Text>
          )}
        </View>

        {/* 텍스트 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>텍스트</Text>

          {editTarget ? (
            <>
              <TextInput
                style={styles.editor}
                value={editValue}
                onChangeText={setEditValue}
                multiline
                autoFocus
                textAlignVertical="top"
              />
              <View style={styles.editRow}>
                <Pressable onPress={() => setEditTarget(null)} style={styles.editBtn}>
                  <Text style={styles.cancelTxt}>취소</Text>
                </Pressable>
                <Pressable onPress={handleSaveEdit} style={styles.editBtn}>
                  <Text style={styles.saveTxt}>저장</Text>
                </Pressable>
              </View>
            </>
          ) : transcript ? (
            <>
              <Text style={styles.bodyText}>{transcript.editedText ?? transcript.rawText}</Text>
              <Pressable onPress={() => openEdit('transcript')}>
                <Text style={styles.editLink}>편집</Text>
              </Pressable>
            </>
          ) : isSTT && entry.mode === 'voice' ? (
            <Text style={styles.muted}>음성을 텍스트로 변환 중…</Text>
          ) : entry.mode === 'silent' ? (
            <>
              <Text style={styles.bodyText}>{entry.manualNote ?? '메모 없음'}</Text>
              <Pressable onPress={() => openEdit('note')}>
                <Text style={styles.editLink}>편집</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.muted}>트랜스크립트 없음</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#fff' },
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8',
  },
  navBtn: { width: 44, alignItems: 'center' },
  backTxt: { fontSize: 26, color: '#111', lineHeight: 30 },
  menuTxt: { fontSize: 22, color: '#111', letterSpacing: 2 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#111' },
  video: { width: '100%', height: 280, backgroundColor: '#000' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  badge: {
    fontSize: 12, fontWeight: '600', color: '#555',
    backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  warnBadge: { backgroundColor: '#fef3c7', color: '#b45309' },
  errBadge: { backgroundColor: '#fee2e2', color: '#dc2626' },
  section: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  bodyText: { fontSize: 15, color: '#222', lineHeight: 24 },
  muted: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  editLink: { fontSize: 14, color: '#007AFF', fontWeight: '500', marginTop: 4 },
  editor: {
    fontSize: 15, color: '#222', lineHeight: 22,
    backgroundColor: '#f7f7f7', borderRadius: 10,
    padding: 12, minHeight: 120,
  },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  editBtn: { paddingVertical: 6 },
  cancelTxt: { fontSize: 15, color: '#888' },
  saveTxt: { fontSize: 15, fontWeight: '600', color: '#007AFF' },
});
