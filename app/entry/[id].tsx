import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Linking, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  clearExportedAt, enqueueJob, getEntry, getLatestTranscript, getSettings,
  softDeleteEntry, updateEditedText, updateManualNote, updateSttStatus,
} from '@/db';
import { kickWorker } from '@/services/jobs/queue';
import { deleteEntryFiles } from '@/lib/storage';
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
  const [regenerating, setRegenerating] = useState(false);
  // 재생성 시 "이전 transcript id"를 기억 — 새 row 도착 감지용
  const prevTranscriptId = useRef<string | null>(null);

  const player = useVideoPlayer(
    entry?.compressedPath ?? entry?.originalPath ?? null,
    (p) => { p.loop = false; },
  );

  // 초기 로드
  useEffect(() => {
    (async () => {
      const e = await getEntry(db, id);
      if (!e) { router.back(); return; }
      setEntry(e);
      const t = await getLatestTranscript(db, e.id);
      setTranscript(t);
      prevTranscriptId.current = t?.id ?? null;
    })();
  }, [db, id]);

  // STT 진행 중: sttStatus가 pending/processing
  const sttInProgress =
    !!entry &&
    (entry.sttStatus === 'pending' || entry.sttStatus === 'processing');

  // 폴링 — STT 대기 중이거나 재생성 요청 후 새 row 기다리는 동안
  useEffect(() => {
    if (!sttInProgress && !regenerating) return;
    if (!entry) return;
    const entryId = entry.id;
    const timerId = setInterval(async () => {
      const [freshEntry, freshTranscript] = await Promise.all([
        getEntry(db, entryId),
        getLatestTranscript(db, entryId),
      ]);
      if (!freshEntry) return;
      setEntry(freshEntry);
      if (freshTranscript) {
        setTranscript(freshTranscript);
        // 이전과 다른 row가 왔으면 재생성 완료
        if (freshTranscript.id !== prevTranscriptId.current) {
          setRegenerating(false);
          prevTranscriptId.current = freshTranscript.id;
        }
      }
    }, 3_000);
    return () => clearInterval(timerId);
  }, [sttInProgress, regenerating, db, entry?.id]);

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
      // ADR-016: raw_text 보존, 화면에는 edited_text 즉시 반영
      setTranscript((t) => t ? { ...t, editedText: editValue } : t);
    } else if (editTarget === 'note') {
      await updateManualNote(db, entry.id, editValue);
      setEntry((e) => e ? { ...e, manualNote: editValue } : e);
    }
    setEditTarget(null);

    // 내용이 바뀌었으므로 vault를 재export해야 함 — exported_at 무효화 + 큐잉
    await clearExportedAt(db, entry.id);
    const settings = await getSettings(db);
    if (settings.obsidianVaultUri && settings.obsidianAutoExport) {
      await enqueueJob(db, 'obsidian_export', entry.id, 'entries');
      kickWorker();
    }
  }, [db, entry, transcript, editTarget, editValue]);

  const handleRegenerate = useCallback(async () => {
    if (!entry || regenerating) return;
    // ADR-010: 기존 row 삭제 없이 새 STT 잡만 enqueue
    prevTranscriptId.current = transcript?.id ?? null;
    setRegenerating(true);
    await enqueueJob(db, 'stt', entry.id, 'entries');
    // 이전에 'failed'였던 경우 폴링이 다시 돌도록 'pending'으로 되돌림
    await updateSttStatus(db, entry.id, 'pending');
    setEntry((e) => (e ? { ...e, sttStatus: 'pending' } : e));
    kickWorker(); // 5초 폴링 대기 없이 즉시 1틱
    console.log(`[entry detail] STT 재생성 enqueue id=${entry.id}`);
  }, [db, entry, transcript, regenerating]);

  const handleDelete = useCallback(() => {
    if (!entry) return;
    Alert.alert(
      '클립 삭제',
      '원본 파일도 함께 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '기록만 삭제',
          onPress: async () => {
            await softDeleteEntry(db, entry.id);
            router.back();
          },
        },
        {
          text: '파일 포함 삭제', style: 'destructive',
          onPress: async () => {
            await softDeleteEntry(db, entry.id);
            deleteEntryFiles(entry);
            router.back();
          },
        },
      ],
    );
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

  const isCompressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';

  const engineLabel = transcript
    ? `${transcript.engine}${transcript.engineVersion ? ` · ${transcript.engineVersion}` : ''}`
    : null;

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
        <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />

        {/* 상태 뱃지 */}
        <View style={styles.badges}>
          <Text style={styles.badge}>{entry.mode === 'voice' ? '독백' : '조용'}</Text>
          <Text style={styles.badge}>{fmtDuration(entry.durationMs)}</Text>
          {isCompressing && <Text style={[styles.badge, styles.warnBadge]}>압축 중</Text>}
          {sttInProgress && <Text style={[styles.badge, styles.warnBadge]}>STT 처리 중</Text>}
          {regenerating && <Text style={[styles.badge, styles.warnBadge]}>재생성 중</Text>}
          {entry.compressionStatus === 'failed' && (
            <Text style={[styles.badge, styles.errBadge]}>압축 실패</Text>
          )}
          {entry.sttStatus === 'failed' && (
            <Text style={[styles.badge, styles.errBadge]}>STT 실패</Text>
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
              <View style={styles.actionRow}>
                <Pressable onPress={() => setEditTarget(null)} style={styles.actionBtn}>
                  <Text style={styles.cancelTxt}>취소</Text>
                </Pressable>
                <Pressable onPress={handleSaveEdit} style={styles.actionBtn}>
                  <Text style={styles.saveTxt}>저장</Text>
                </Pressable>
              </View>
            </>
          ) : transcript ? (
            <>
              <Text style={styles.bodyText}>{transcript.editedText ?? transcript.rawText}</Text>
              {engineLabel && <Text style={styles.engineInfo}>{engineLabel}</Text>}
              <View style={styles.actionRow}>
                <Pressable onPress={() => openEdit('transcript')} style={styles.actionBtn}>
                  <Text style={styles.linkTxt}>편집</Text>
                </Pressable>
                {entry.mode === 'voice' && (
                  <Pressable
                    onPress={handleRegenerate}
                    disabled={regenerating}
                    style={styles.actionBtn}
                  >
                    <Text style={[styles.linkTxt, regenerating && styles.disabledTxt]}>
                      재생성
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : sttInProgress ? (
            <Text style={styles.muted}>음성을 텍스트로 변환 중…</Text>
          ) : entry.mode === 'silent' ? (
            <>
              <Text style={styles.bodyText}>{entry.manualNote ?? '메모 없음'}</Text>
              <View style={styles.actionRow}>
                <Pressable onPress={() => openEdit('note')} style={styles.actionBtn}>
                  <Text style={styles.linkTxt}>편집</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.muted}>
                {entry.sttStatus === 'failed' ? 'STT 실패 — 재시도해 보세요' : '트랜스크립트 없음'}
              </Text>
              {entry.mode === 'voice' && (
                <Pressable
                  onPress={handleRegenerate}
                  disabled={regenerating}
                  style={styles.actionBtn}
                >
                  <Text style={[styles.linkTxt, regenerating && styles.disabledTxt]}>
                    {regenerating ? '재생성 중…' : '재시도'}
                  </Text>
                </Pressable>
              )}
            </>
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
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  bodyText: { fontSize: 15, color: '#222', lineHeight: 24 },
  muted: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  engineInfo: { fontSize: 11, color: '#bbb', marginTop: -4 },
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  actionBtn: { paddingVertical: 4 },
  linkTxt: { fontSize: 14, color: '#007AFF', fontWeight: '500' },
  disabledTxt: { color: '#aaa' },
  editor: {
    fontSize: 15, color: '#222', lineHeight: 22,
    backgroundColor: '#f7f7f7', borderRadius: 10,
    padding: 12, minHeight: 120,
  },
  cancelTxt: { fontSize: 15, color: '#888' },
  saveTxt: { fontSize: 15, fontWeight: '600', color: '#007AFF' },
});
