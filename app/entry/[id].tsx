/** @codemap Entry 상세(/entry/:id) — 재생·노트·transcript·Decision·삭제
 *  데이터: @/db(entries·transcripts·decisions) · 삭제 services/deleteEntry · 잡상태 services/jobs/errors
 *  관련 ADR: 003, 010, 016
 */
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Linking, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';

import { DeleteEntryDialog } from '@/components/DeleteEntryDialog';
import { ActionSheet, type ActionItem, AppText, Icon, Polaroid, ScreenBackground, Tag, Tape } from '@/components/ui';
import { EntryTextSection } from '@/components/entry/EntryTextSection';
import { FailureCard, type Failure } from '@/components/entry/FailureCard';
import { TextRevisionSheet } from '@/components/revision/TextRevisionSheet';
import {
  clearExportedAt, enqueueJob,
  getEntry, getLastJobForTarget, getLatestTranscript, getSettings,
  updateAiLabelStatus, updateCompressionResult,
  updateEditedText, updateManualNote, updateSttStatus,
} from '@/db';
import { deleteEntryWithCleanup } from '@/services/deleteEntry';
import { classifyJobError } from '@/services/jobs/errors';
import { kickWorker } from '@/services/jobs/queue';
import { openEntryInObsidian } from '@/lib/obsidian';
import { colors, iconSize, radius, shadow, spacing } from '@/theme';
import type { AiJobType, Entry, Transcript } from '@/types/domain';

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

type EditTarget = 'transcript' | 'note' | null;

const MODE_LABEL: Record<string, string> = {
  voice: '독백', silent: '조용', audio: '녹음', text: '메모',
};

// 압축 단계 라벨 (v11). 0=원본만, 1=기본, 2/3=심화.
const COMPRESSION_LEVEL_LABEL: Record<number, string> = {
  0: '원본', 1: '압축 L1', 2: '압축 L2', 3: '압축 L3',
};

export default function EntryDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [vaultConnected, setVaultConnected] = useState(false);
  const [backupConfigured, setBackupConfigured] = useState(false);
  const [backupPending, setBackupPending] = useState(false);
  const [failures, setFailures] = useState<Failure[]>([]);
  // 폴라로이드 뒷면 카드 폭(측정) — 앞면 사진과 같은 크기로 비침/최소높이 계산
  const [backW, setBackW] = useState(0);
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
      result.push({ type, info: classifyJobError(job?.lastError, type), raw: job?.lastError });
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
      setBackupConfigured(!!s.backupDirUri);
      refreshFailures(e);
    })();
  }, [db, id, refreshFailures]);

  // STT 진행 중: sttStatus가 pending/processing
  const sttInProgress =
    !!entry &&
    (entry.sttStatus === 'pending' || entry.sttStatus === 'processing');

  // 압축 진행 중: compressionStatus가 pending/processing (단계 올리기 포함)
  const compressionInProgress =
    !!entry &&
    (entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing');

  // 폴링 — STT/압축/백업 진행 중이거나 재생성 요청 후 새 row 기다리는 동안
  useEffect(() => {
    if (!sttInProgress && !regenerating && !compressionInProgress && !backupPending) return;
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
      if (backupPending && freshEntry.originalBackedUpAt != null) setBackupPending(false);
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
  }, [sttInProgress, regenerating, compressionInProgress, backupPending, db, entry?.id]);

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

  // 리비전 시트(전사 AI 재작성·복원·수동수정)에서 현재값이 바뀌면 호출 — DB 반영은 시트가 끝냄.
  // 여기선 화면 상태 갱신 + 내용 변경에 따른 vault 재내보내기만 처리한다.
  const handleTranscriptApplied = useCallback(async (content: string) => {
    setTranscript((t) => (t ? { ...t, editedText: content } : t));
    if (!entry) return;
    await clearExportedAt(db, entry.id);
    const settings = await getSettings(db);
    if (settings.obsidianVaultUri && settings.obsidianAutoExport) {
      await enqueueJob(db, 'obsidian_export', entry.id, 'entries');
      kickWorker();
    }
  }, [db, entry]);

  // 수동 단계 올리기 — 현재 단계+1(최대 3)로 재압축 잡 enqueue. 원본에서 재압축하므로
  // 원본이 정리된(purged) 엔트리는 호출부에서 메뉴를 숨겨 막는다.
  const compressToNextLevel = useCallback(async () => {
    if (!entry) return;
    const current = entry.compressionLevel ?? 0;
    const next = Math.min(current + 1, 3);
    if (next <= current) return;
    await enqueueJob(db, 'compression', entry.id, 'entries', JSON.stringify({ level: next }));
    await updateCompressionResult(db, entry.id, 'pending');
    setEntry((e) => (e ? { ...e, compressionStatus: 'pending' } : e));
    kickWorker();
    console.log(`[entry detail] 압축 L${next} enqueue id=${entry.id}`);
  }, [db, entry]);

  // 수동 원본 백업 — 백업 잡 enqueue. 폴더 미설정 시 안내. 완료는 폴링으로 '백업됨' 반영.
  const backupOriginal = useCallback(async () => {
    if (!entry) return;
    if (!backupConfigured) {
      Alert.alert('백업 폴더 필요', '설정 → 영상 백업에서 백업 폴더를 먼저 선택하세요.');
      return;
    }
    await enqueueJob(db, 'original_backup', entry.id, 'entries');
    setBackupPending(true);
    kickWorker();
    Alert.alert('원본 백업 시작', '백업이 완료되면 "백업됨"으로 표시됩니다.');
    console.log(`[entry detail] original_backup enqueue id=${entry.id}`);
  }, [db, entry, backupConfigured]);

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
    await deleteEntryWithCleanup(db, entry, opts);
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
      ? [{ label: '원본 영상 열기', icon: 'archive' as const, onPress: () => Linking.openURL(entry.originalPath) }]
      : []),
    ...(vaultConnected
      ? [{ label: '옵시디언에서 열기', icon: 'open' as const, onPress: handleOpenInObsidian }]
      : []),
    ...((entry.mode === 'voice' || entry.mode === 'silent')
      && (entry.compressionLevel ?? 0) < 3
      && entry.originalPurgedAt == null
      && !compressionInProgress
      ? [{
          label: `압축 단계 올리기 → L${Math.min((entry.compressionLevel ?? 0) + 1, 3)}`,
          icon: 'box' as const,
          onPress: compressToNextLevel,
        }]
      : []),
    ...(entry.mode !== 'text'
      && entry.originalBackedUpAt == null
      && entry.originalPurgedAt == null
      && !backupPending
      ? [{ label: '원본 백업', icon: 'upload' as const, onPress: backupOriginal }]
      : []),
    { label: '삭제', icon: 'trash', onPress: handleDelete, destructive: true },
  ] : [];

  if (!entry) return <View style={styles.loading} />;

  // 영상(녹화) 모드 — 폴라로이드 + 뒷면 메모 컨셉
  const isVideo = entry.mode === 'voice' || entry.mode === 'silent';

  const isCompressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';

  const engineLabel = transcript
    ? `${transcript.engine}${transcript.engineVersion ? ` · ${transcript.engineVersion}` : ''}`
    : null;

  const warn = (label: string) => (
    <Tag key={label} label={label} bg={colors.feedback.warningTrack} color={colors.feedback.warning} />
  );

  const textSection = (
    <EntryTextSection
      entry={entry}
      transcript={transcript}
      editTarget={editTarget}
      editValue={editValue}
      regenerating={regenerating}
      sttInProgress={sttInProgress}
      engineLabel={engineLabel}
      bare={isVideo}
      onChangeEditValue={setEditValue}
      onCancelEdit={() => setEditTarget(null)}
      onSaveEdit={handleSaveEdit}
      onOpenEdit={openEdit}
      onRegenerate={handleRegenerate}
      onOpenRevision={() => setRevisionOpen(true)}
    />
  );

  // 폴라로이드 하단 필기체 해시태그(모드·길이·압축·상태)
  const videoTags = [
    `#${MODE_LABEL[entry.mode] ?? entry.mode}`,
    `#${fmtDuration(entry.durationMs)}`,
    `#${COMPRESSION_LEVEL_LABEL[entry.compressionLevel ?? 0] ?? '원본'}`,
    ...(entry.originalPurgedAt != null ? ['#원본정리됨'] : entry.originalBackedUpAt != null ? ['#백업됨'] : []),
    ...(isCompressing ? ['#압축중'] : []),
    ...(sttInProgress ? ['#STT처리중'] : []),
    ...(regenerating ? ['#재생성중'] : []),
    ...(backupPending ? ['#백업중'] : []),
    ...(entry.compressionStatus === 'failed' ? ['#압축실패'] : []),
    ...(entry.sttStatus === 'failed' ? ['#STT실패'] : []),
  ].join('  ');

  return (
    <KeyboardAvoidingView
      // Android edge-to-edge에서는 adjustResize가 무력화되므로 padding으로 편집 입력창을 키보드 위로 올린다
      behavior="padding"
      style={styles.root}
    >
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
            <Icon name="back" size={iconSize.lg} color={colors.text.primary} />
          </Pressable>
          <AppText preset="titleMedium" numberOfLines={1} style={styles.headerTitle}>
            {format(new Date(entry.recordedAt), 'M월 d일 HH:mm', { locale: ko })}
          </AppText>
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={spacing.sm} style={styles.navBtn}>
            <Icon name="more" size={iconSize.md} color={colors.text.primary} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {isVideo ? (
            <>
              {/* 영상: 위에 테이프로 붙인 폴라로이드 + 하단 필기체 해시태그 */}
              <View style={styles.polaroidWrap}>
                <View style={styles.polaroidTape} pointerEvents="none">
                  <Tape width={74} height={22} angle={-4} vary={`vid-${entry.id}`} />
                </View>
                <Polaroid
                  tilt={-1}
                  aspectRatio={16 / 9}
                  duration={entry.durationMs}
                  footer={<AppText preset="scriptTag" color={colors.text.secondary}>{videoTags}</AppText>}
                  typeIcon={<View style={styles.typeChip}><Icon name="video" size={iconSize.sm} color={colors.text.onMedia} /></View>}
                >
                  <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
                </Polaroid>
              </View>

              {/* 폴라로이드 뒷면 — 세로 테이프로 사진과 연결, 안쪽엔 앞면 사진이 비쳐 보인다 */}
              <View style={styles.backWrap}>
                <View style={styles.seamTapes} pointerEvents="none">
                  <Tape width={26} height={66} angle={0} vary={`seamL-${entry.id}`} />
                  <Tape width={26} height={66} angle={0} vary={`seamR-${entry.id}`} />
                </View>
                <View
                  style={[styles.back, backW > 0 && { minHeight: (backW - spacing.sm * 2) * 9 / 16 + spacing.sm * 2 }]}
                  onLayout={(e) => setBackW(e.nativeEvent.layout.width)}
                >
                  {entry.thumbnailPath && (
                    <Image source={{ uri: entry.thumbnailPath }} style={styles.bleed} blurRadius={8} resizeMode="cover" />
                  )}
                  {textSection}
                </View>
              </View>

              <FailureCard failures={failures} onRetry={retryStage} />
            </>
          ) : (
            <>
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
                {backupPending && warn('백업 중')}
                {entry.sttStatus === 'failed' && (
                  <Tag label="STT 실패" bg={colors.feedback.warningTrack} color={colors.feedback.danger} />
                )}
              </View>

              <FailureCard failures={failures} onRetry={retryStage} />
              {textSection}
            </>
          )}
        </ScrollView>

        {transcript && (
          <TextRevisionSheet
            key={transcript.id}
            visible={revisionOpen}
            title="전사 수정 · 기록"
            onClose={() => setRevisionOpen(false)}
            target={{ kind: 'transcript', transcriptId: transcript.id }}
            aiOriginal={transcript.rawText}
            initialCurrent={transcript.editedText ?? transcript.rawText}
            targetLabel="음성 전사(STT)"
            onApplied={handleTranscriptApplied}
          />
        )}
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

  // 영상 폴라로이드(위에 테이프로 붙임)
  polaroidWrap: { marginTop: spacing.lg },
  polaroidTape: { position: 'absolute', top: -spacing.sm, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  typeChip: { backgroundColor: colors.media.durationPillBg, borderRadius: radius.sm, padding: spacing.xs },

  // 폴라로이드 뒷면 — 세로 테이프로 사진과 연결
  backWrap: { marginTop: spacing.lg },
  seamTapes: {
    position: 'absolute', top: -spacing['2xl'], left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: spacing['4xl'], zIndex: 2,
  },
  back: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.sm,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.raised,
  },
  // 앞면 사진이 뒤에서 희미하게 비쳐 보이는 효과 — 폴라로이드 영상과 같은 크기/위치(프레임 여백 sm)
  bleed: {
    position: 'absolute',
    top: spacing.sm, left: spacing.sm, right: spacing.sm,
    aspectRatio: 16 / 9,
    opacity: 0.07,
    borderRadius: radius.xs,
    transform: [{ scaleX: -1 }],
  },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.md },
});
