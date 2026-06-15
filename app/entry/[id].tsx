import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Directory } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { DeleteEntryDialog } from '@/components/DeleteEntryDialog';
import { ActionSheet, type ActionItem, AppText, Button, Card, ScreenBackground, Tag } from '@/components/ui';
import {
  cancelJobsForTarget, clearExportedAt, enqueueJob, getEntriesByDay,
  getEntry, getLastJobForTarget, getLatestTranscript, getSettings,
  softDeleteEntry, updateAiLabelStatus, updateCompressionResult,
  updateEditedText, updateManualNote, updateSttStatus,
} from '@/db';
import { JOB_STAGE_LABEL, classifyJobError, type ClassifiedError } from '@/services/jobs/errors';
import { kickWorker } from '@/services/jobs/queue';
import {
  deleteEmptyDayNote, deleteEntryMediaFromVault,
} from '@/services/obsidian';
import { openEntryInObsidian } from '@/lib/obsidian';
import { deleteEntryFiles } from '@/lib/storage';
import { getDayBoundary } from '@/lib/time';
import { colors, iconSize, radius, spacing } from '@/theme';
import type { AiJobType, Entry, Transcript } from '@/types/domain';

type Failure = { type: AiJobType; info: ClassifiedError };

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

type EditTarget = 'transcript' | 'note' | null;

const MODE_LABEL: Record<string, string> = {
  voice: '독백', silent: '조용', audio: '녹음', text: '메모',
};

export default function EntryDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [vaultConnected, setVaultConnected] = useState(false);
  const [failures, setFailures] = useState<Failure[]>([]);
  // 재생성 시 "이전 transcript id"를 기억 — 새 row 도착 감지용
  const prevTranscriptId = useRef<string | null>(null);

  // 실패한 단계의 잡에서 사유를 읽어 분류
  const refreshFailures = useCallback(async (e: Entry) => {
    const checks: Array<[AiJobType, boolean]> = [
      ['compression', e.compressionStatus === 'failed'],
      ['stt', e.sttStatus === 'failed'],
      ['label_extraction', e.aiLabelStatus === 'failed'],
    ];
    const result: Failure[] = [];
    for (const [type, failed] of checks) {
      if (!failed) continue;
      const job = await getLastJobForTarget(db, e.id, type);
      result.push({ type, info: classifyJobError(job?.lastError, type) });
    }
    setFailures(result);
  }, [db]);

  // text mode는 미디어 파일이 없음 — player에 빈 source 전달하지 않도록 null
  const isText = entry?.mode === 'text';
  const videoSource = isText
    ? null
    : (entry?.compressedPath ?? entry?.originalPath ?? null);
  const player = useVideoPlayer(videoSource, (p) => { p.loop = false; });

  // 초기 로드
  useEffect(() => {
    (async () => {
      const e = await getEntry(db, id);
      if (!e) { router.back(); return; }
      setEntry(e);
      const t = await getLatestTranscript(db, e.id);
      setTranscript(t);
      prevTranscriptId.current = t?.id ?? null;
      const s = await getSettings(db);
      setVaultConnected(!!s.obsidianVaultUri);
      refreshFailures(e);
    })();
  }, [db, id, refreshFailures]);

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
      refreshFailures(freshEntry);
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
      // silent/text 클립에 메모가 처음 작성/변경되면 label_extraction 트리거
      if (
        (entry.mode === 'silent' || entry.mode === 'text') &&
        (entry.aiLabelStatus === 'skipped' || entry.aiLabelStatus === 'pending')
      ) {
        await enqueueJob(db, 'label_extraction', entry.id, 'entries');
        kickWorker();
      }
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

  // 실패한 단계 재시도 — 상태를 pending으로 되돌리고 잡 재큐잉
  const retryStage = useCallback(async (type: AiJobType) => {
    if (!entry) return;
    if (type === 'compression') {
      await updateCompressionResult(db, entry.id, 'pending');
      setEntry((e) => (e ? { ...e, compressionStatus: 'pending' } : e));
    } else if (type === 'stt') {
      prevTranscriptId.current = transcript?.id ?? null;
      setRegenerating(true);
      await updateSttStatus(db, entry.id, 'pending');
      setEntry((e) => (e ? { ...e, sttStatus: 'pending' } : e));
    } else if (type === 'label_extraction') {
      await updateAiLabelStatus(db, entry.id, 'pending');
      setEntry((e) => (e ? { ...e, aiLabelStatus: 'pending' } : e));
    }
    await enqueueJob(db, type, entry.id, 'entries');
    setFailures((f) => f.filter((x) => x.type !== type));
    kickWorker();
    console.log(`[entry detail] ${type} 재시도 enqueue id=${entry.id}`);
  }, [db, entry, transcript]);

  const handleDelete = useCallback(() => {
    if (!entry) return;
    setDeleteDialogVisible(true);
  }, [entry]);

  const handleConfirmDelete = useCallback(async (
    opts: { deleteFiles: boolean; deleteFromVault: boolean },
  ) => {
    if (!entry) return;
    setDeleteDialogVisible(false);

    const settings = await getSettings(db);

    // 1) vault 미디어 삭제 (soft delete 전에 — entry 정보가 필요)
    if (opts.deleteFromVault && settings.obsidianVaultUri) {
      try {
        const vaultDir = new Directory(settings.obsidianVaultUri);
        if (vaultDir.exists) {
          deleteEntryMediaFromVault(vaultDir, entry);
        }
      } catch (e) {
        console.warn('[entry delete] vault media cleanup failed:', e);
      }
    }

    // 2) DB soft delete + 진행 중 잡 cancel
    await softDeleteEntry(db, entry.id);
    await cancelJobsForTarget(db, entry.id);

    // 3) 로컬 파일 삭제
    if (opts.deleteFiles) deleteEntryFiles(entry);

    // 4) vault 데일리 노트 갱신 — 같은 날 다른 entry 1개를 트리거로 큐잉
    if (opts.deleteFromVault && settings.obsidianVaultUri) {
      try {
        const { start, end } = getDayBoundary(entry.recordedAt, settings.dayBoundaryHour);
        const siblings = await getEntriesByDay(db, start, end);
        if (siblings.length > 0) {
          await enqueueJob(db, 'obsidian_export', siblings[0].id, 'entries');
          kickWorker();
        } else {
          // 같은 날 entry가 없으면 빈 데일리 노트 삭제
          const vaultDir = new Directory(settings.obsidianVaultUri);
          if (vaultDir.exists) {
            deleteEmptyDayNote(vaultDir, entry.recordedAt, settings.dayBoundaryHour);
          }
        }
      } catch (e) {
        console.warn('[entry delete] vault note refresh failed:', e);
      }
    }

    router.back();
  }, [db, entry]);

  // obsidian://open URI로 이 entry의 데일리 노트를 연다 (ADR-026).
  const handleOpenInObsidian = useCallback(async () => {
    if (!entry) return;
    if (!entry.exportedAt) {
      Alert.alert('아직 내보내지 않은 일기', 'STT가 끝나면 자동으로 내보내집니다.');
      return;
    }
    await openEntryInObsidian(db, entry.recordedAt);
  }, [db, entry]);

  const menuItems: ActionItem[] = entry ? [
    { label: '뒤로가기', icon: 'arrow-back', onPress: () => router.back() },
    ...(entry.mode !== 'text'
      ? [{ label: '원본 영상 열기', icon: 'film-outline' as const, onPress: () => Linking.openURL(entry.originalPath) }]
      : []),
    ...(vaultConnected
      ? [{ label: '옵시디언에서 열기', icon: 'open-outline' as const, onPress: handleOpenInObsidian }]
      : []),
    { label: '삭제', icon: 'trash-outline', onPress: handleDelete, destructive: true },
  ] : [];

  if (!entry) return <View style={styles.loading} />;

  const isCompressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';

  const engineLabel = transcript
    ? `${transcript.engine}${transcript.engineVersion ? ` · ${transcript.engineVersion}` : ''}`
    : null;

  const warn = (label: string) => (
    <Tag key={label} label={label} bg={colors.feedback.warningTrack} color={colors.feedback.warning} />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScreenBackground edges={['top']}>
        <DeleteEntryDialog
          visible={deleteDialogVisible}
          vaultConnected={vaultConnected}
          onCancel={() => setDeleteDialogVisible(false)}
          onConfirm={handleConfirmDelete}
        />
        <ActionSheet visible={menuVisible} onClose={() => setMenuVisible(false)} items={menuItems} />

        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={spacing.sm} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text.primary} />
          </Pressable>
          <AppText preset="titleMedium" numberOfLines={1} style={styles.headerTitle}>
            {format(new Date(entry.recordedAt), 'M월 d일 HH:mm', { locale: ko })}
          </AppText>
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={spacing.sm} style={styles.navBtn}>
            <Ionicons name="ellipsis-horizontal" size={iconSize.md} color={colors.text.primary} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {/* text mode는 미디어 없음 — VideoView 렌더링 생략 */}
          {!isText && (
            <View style={styles.videoFrame}>
              <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
            </View>
          )}

          {/* 상태 뱃지 */}
          <View style={styles.badges}>
            <Tag label={MODE_LABEL[entry.mode] ?? entry.mode} bg={colors.surface.sunken} color={colors.text.secondary} />
            {!isText && <Tag label={fmtDuration(entry.durationMs)} bg={colors.surface.sunken} color={colors.text.secondary} />}
            {isCompressing && warn('압축 중')}
            {sttInProgress && warn('STT 처리 중')}
            {regenerating && warn('재생성 중')}
            {entry.compressionStatus === 'failed' && (
              <Tag label="압축 실패" bg={colors.feedback.warningTrack} color={colors.feedback.danger} />
            )}
            {entry.sttStatus === 'failed' && (
              <Tag label="STT 실패" bg={colors.feedback.warningTrack} color={colors.feedback.danger} />
            )}
          </View>

          {/* 처리 실패 — 왜/어디서/어떻게 + 재시도 */}
          {failures.length > 0 && (
            <Card style={styles.failCard}>
              <AppText preset="caption" color={colors.feedback.danger} style={styles.sectionTitle}>처리 실패</AppText>
              {failures.map((f) => (
                <View key={f.type} style={styles.failRow}>
                  <View style={styles.failText}>
                    <AppText preset="bodyMedium">{`${JOB_STAGE_LABEL[f.type]} — ${f.info.why}`}</AppText>
                    <AppText preset="caption" color={colors.text.secondary}>{f.info.how}</AppText>
                  </View>
                  <Button label="재시도" variant="secondary" size="sm" onPress={() => retryStage(f.type)} />
                </View>
              ))}
            </Card>
          )}

          {/* 텍스트 섹션 */}
          <Card style={styles.section}>
            <AppText preset="caption" color={colors.text.tertiary} style={styles.sectionTitle}>텍스트</AppText>

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
                    <AppText preset="button" color={colors.text.secondary}>취소</AppText>
                  </Pressable>
                  <Pressable onPress={handleSaveEdit} style={styles.actionBtn}>
                    <AppText preset="button" color={colors.text.link}>저장</AppText>
                  </Pressable>
                </View>
              </>
            ) : transcript ? (
              <>
                <AppText preset="bodyMedium">{transcript.editedText ?? transcript.rawText}</AppText>
                {engineLabel && <AppText preset="caption" color={colors.text.tertiary}>{engineLabel}</AppText>}
                <View style={styles.actionRow}>
                  <Pressable onPress={() => openEdit('transcript')} style={styles.actionBtn}>
                    <AppText preset="caption" color={colors.text.link}>편집</AppText>
                  </Pressable>
                  {entry.mode === 'voice' && (
                    <Pressable onPress={handleRegenerate} disabled={regenerating} style={styles.actionBtn}>
                      <AppText preset="caption" color={regenerating ? colors.text.tertiary : colors.text.link}>재생성</AppText>
                    </Pressable>
                  )}
                </View>
              </>
            ) : sttInProgress ? (
              <AppText preset="bodyMedium" color={colors.text.tertiary}>음성을 텍스트로 변환 중…</AppText>
            ) : (entry.mode === 'silent' || entry.mode === 'text') ? (
              <>
                <AppText preset="bodyMedium">{entry.manualNote ?? '메모 없음'}</AppText>
                <View style={styles.actionRow}>
                  <Pressable onPress={() => openEdit('note')} style={styles.actionBtn}>
                    <AppText preset="caption" color={colors.text.link}>편집</AppText>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <AppText preset="bodyMedium" color={colors.text.tertiary}>
                  {entry.sttStatus === 'failed' ? 'STT 실패 — 재시도해 보세요' : '트랜스크립트 없음'}
                </AppText>
                {entry.mode === 'voice' && (
                  <Pressable onPress={handleRegenerate} disabled={regenerating} style={styles.actionBtn}>
                    <AppText preset="caption" color={regenerating ? colors.text.tertiary : colors.text.link}>
                      {regenerating ? '재생성 중…' : '재시도'}
                    </AppText>
                  </Pressable>
                )}
              </>
            )}
          </Card>
        </ScrollView>
      </ScreenBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background.canvas },
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
  },
  navBtn: { width: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
  videoFrame: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm,
  },
  video: { width: '100%', height: 260, borderRadius: radius.md, backgroundColor: colors.media.cameraBg },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.md },
  failCard: { gap: spacing.sm, marginBottom: spacing.md, borderColor: colors.feedback.warning },
  failRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  failText: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: { letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  actionBtn: { paddingVertical: spacing.xs },
  editor: {
    fontSize: 15, color: colors.text.primary, lineHeight: 22,
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    padding: spacing.md, minHeight: 120,
  },
});
