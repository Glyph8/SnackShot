/** @codemap 오늘 탭(/today) — 하루 단위 Entry 목록 · 녹화/작성 진입
 *  데이터: @/db(entries 등) · 삭제 services/deleteEntry · 잡 services/jobs/queue · 상태 stores/today
 *  관련 ADR: 003(클립 1급), 013(시각) · 형제: archive, inbox, entry/[id]
 */
import { addDays, addHours, format, isToday, parseISO, startOfDay, subDays } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Keyboard, KeyboardAvoidingView,
  type NativeScrollEvent, type NativeSyntheticEvent,
  Pressable, RefreshControl, StyleSheet, TextInput, View,
} from 'react-native';

import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { EntryCard } from '@/components/EntryCard';
import { EntryDiaryItem } from '@/components/EntryDiaryItem';
import { ScrollFab } from '@/components/today/ScrollFab';
import { TodayComposer } from '@/components/today/TodayComposer';
import { TodayHeader } from '@/components/today/TodayHeader';
import { AppearIn, AppText, Button, EmptyMomentArt, IllustrationSlot, LinedPaper, ScreenBackground, Shimmer } from '@/components/ui';
import {
  countExtractedDecisions, enqueueJob, getEntriesByDay, getLatestTranscript,
  getPrimaryDecisionForEntry, getSettings, insertTextEntry, updateManualNote, updateUserEdit,
} from '@/db';
import { haptics } from '@/lib/haptics';
import { getDayBoundary } from '@/lib/time';
import { deleteEntryWithCleanup } from '@/services/deleteEntry';
import { kickWorker } from '@/services/jobs/queue';
import type { EditParams } from '@/stores/inbox';
import { useTodayStore } from '@/stores/today';
import { colors, layout, spacing } from '@/theme';
import type { Decision, Entry, Transcript } from '@/types/domain';

type ViewMode = 'list' | 'diary';

interface Item {
  entry: Entry;
  transcript: Transcript | null;
  decision: Decision | null;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { viewDate, setViewDate } = useTodayStore();
  const viewDateObj = parseISO(viewDate);

  const [viewMode, setViewMode] = useState<ViewMode>('diary');
  const [items, setItems] = useState<Item[]>([]);
  const [decisionCount, setDecisionCount] = useState(0);
  const [vaultConnected, setVaultConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState('');
  const [addingMemo, setAddingMemo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composerH, setComposerH] = useState(0);
  // 메모 인라인 편집 / 의사결정 수정
  const [editMemoId, setEditMemoId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);
  // 스크롤 위치: 'top' | 'middle' | 'bottom' | 'none'(스크롤 불필요)
  const [scrollPos, setScrollPos] = useState<'top' | 'middle' | 'bottom' | 'none'>('none');
  const listRef = useRef<FlatList<Item>>(null);

  const scrollToTop = useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), []);
  const scrollToBottom = useCallback(() => listRef.current?.scrollToEnd({ animated: true }), []);
  const initialLoadDone = useRef(false);
  // 동시 load() 실행 방지 — interval과 focus 이벤트가 겹칠 때 DB prepared statement 충돌 방지
  const loadInProgressRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const load = useCallback(async () => {
    if (loadInProgressRef.current) return;
    loadInProgressRef.current = true;
    if (!initialLoadDone.current && mountedRef.current) setLoading(true);
    try {
      const settings = await getSettings(db);
      const noonMs = addHours(startOfDay(parseISO(viewDate)), 12).getTime();
      const { start, end } = getDayBoundary(noonMs, settings.dayBoundaryHour);
      const entries = await getEntriesByDay(db, start, end);
      const loaded = await Promise.all(
        entries.map(async (entry) => ({
          entry,
          transcript: await getLatestTranscript(db, entry.id),
          // 텍스트 엔트리만 결정 여부 조회 ('메모' vs '의사결정' 구분)
          decision: entry.mode === 'text' ? await getPrimaryDecisionForEntry(db, entry.id) : null,
        })),
      );
      // 최근 항목이 아래로 가도록 오래된 → 최신 순 정렬
      loaded.sort((a, b) => a.entry.recordedAt - b.entry.recordedAt);
      const decisions = await countExtractedDecisions(db);
      if (mountedRef.current) {
        setItems(loaded);
        setDecisionCount(decisions);
        setVaultConnected(!!settings.obsidianVaultUri);
      }
    } catch (e) {
      console.error('[today] load failed', e);
    } finally {
      loadInProgressRef.current = false;
      if (mountedRef.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [db, viewDate]);

  // viewDate 변경 시 로딩 상태 리셋 후 재로드
  useEffect(() => {
    initialLoadDone.current = false;
    load();
  }, [load]);

  // 탭 포커스마다 재로드 — 저장 후 즉시 반영
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePrevDay = useCallback(() => {
    setViewDate(format(subDays(viewDateObj, 1), 'yyyy-MM-dd'));
  }, [viewDateObj, setViewDate]);

  const handleNextDay = useCallback(() => {
    if (isToday(viewDateObj)) return;
    setViewDate(format(addDays(viewDateObj, 1), 'yyyy-MM-dd'));
  }, [viewDateObj, setViewDate]);

  const handleUpload = useCallback(async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        // 시스템 피커가 직접 캐시로 복사 → file:// URI 반환, preview.tsx의 File.move() 그대로 동작
        copyToCacheDirectory: true,
      });
    } catch {
      Alert.alert('오류', '파일을 불러올 수 없습니다.');
      return;
    }
    if (result.canceled || !result.assets?.[0]) return;
    router.push({
      pathname: '/preview',
      params: { uri: result.assets[0].uri, durationMs: 0, recordedAt: Date.now() },
    });
  }, []);

  const handleDelete = useCallback(
    async (entry: Entry, opts: { deleteFiles: boolean; deleteFromVault: boolean }) => {
      await deleteEntryWithCleanup(db, entry, opts);
      setItems((prev) => prev.filter((i) => i.entry.id !== entry.id));
    },
    [db],
  );

  // 텍스트 항목 탭: 의사결정 → 수정 시트 / 메모 → 인라인 편집. (미디어는 상세로)
  const handlePressEntry = useCallback((item: Item) => {
    if (item.entry.mode !== 'text') {
      router.push(`/entry/${item.entry.id}`);
      return;
    }
    if (item.decision) {
      setEditingDecision(item.decision);
    } else {
      setEditMemoId(item.entry.id);
      setMemoDraft(item.entry.manualNote ?? '');
    }
  }, []);

  const handleSaveMemo = useCallback(async () => {
    Keyboard.dismiss(); // 저장 시 키보드 자동 내림
    const text = memoDraft.trim();
    if (!text || !editMemoId) { setEditMemoId(null); return; }
    await updateManualNote(db, editMemoId, text);
    setEditMemoId(null);
    await load();
  }, [db, editMemoId, memoDraft, load]);

  const handleSaveDecisionEdit = useCallback(async (edits: EditParams) => {
    const target = editingDecision;
    setEditingDecision(null);
    if (!target) return;
    await updateUserEdit(db, target.id, {
      ...edits,
      followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
    });
    await load();
  }, [db, editingDecision, load]);

  // 메모를 Today에서 바로 작성·추가 (별도 페이지 없이 인라인 insert)
  const handleAddMemo = useCallback(async () => {
    const text = memo.trim();
    if (!text || addingMemo) return;
    Keyboard.dismiss(); // 추가 시 키보드 자동 내림
    setAddingMemo(true);
    try {
      // 오늘 보기면 현재 시각, 과거 날짜 보기면 그 날 정오로 기록
      const recordedAt = isToday(viewDateObj)
        ? Date.now()
        : addHours(startOfDay(viewDateObj), 12).getTime();
      const entry = await insertTextEntry(db, { recordedAt, body: text });
      await enqueueJob(db, 'label_extraction', entry.id, 'entries');
      const settings = await getSettings(db);
      if (settings.obsidianVaultUri && settings.obsidianAutoExport) {
        await enqueueJob(db, 'obsidian_export', entry.id, 'entries');
      }
      kickWorker();
      setMemo('');
      await load();
      setTimeout(scrollToBottom, 100); // 새 메모(맨 아래)로 이동
    } catch (e) {
      console.error('[today] add memo failed', e);
      Alert.alert('저장 실패', '다시 시도해 주세요.');
    } finally {
      setAddingMemo(false);
    }
  }, [memo, addingMemo, viewDateObj, db, load, scrollToBottom]);

  // 처리 중인 항목이 있으면 3초마다 폴링 — 압축/STT 완료 즉시 반영
  const hasActiveJobs = items.some(
    (i) =>
      i.entry.compressionStatus === 'pending' || i.entry.compressionStatus === 'processing' ||
      i.entry.sttStatus === 'pending' || i.entry.sttStatus === 'processing',
  );
  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = setInterval(() => load(), 3_000);
    return () => clearInterval(id);
  }, [hasActiveJobs, load]);

  // Today 탭을 누르면 맨 아래(최신)로 이동
  useEffect(() => {
    // expo-router의 navigation 타입엔 tabPress가 없어 좁은 인터페이스로 캐스팅
    const nav = navigation as unknown as {
      addListener: (event: 'tabPress', cb: () => void) => () => void;
    };
    const unsub = nav.addListener('tabPress', () => {
      setTimeout(scrollToBottom, 50);
    });
    return unsub;
  }, [navigation, scrollToBottom]);

  // 스크롤 위치에 따라 이동 버튼 상태 갱신
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const scrollable = contentSize.height - layoutMeasurement.height;
    if (scrollable <= 8) { setScrollPos('none'); return; }
    const y = contentOffset.y;
    const pos = y <= 8 ? 'top' : y >= scrollable - 8 ? 'bottom' : 'middle';
    setScrollPos((prev) => (prev === pos ? prev : pos));
  }, []);

  const isTodayDate = isToday(viewDateObj);

  return (
    <KeyboardAvoidingView
      // Android edge-to-edge에서는 adjustResize가 무력화되므로 두 플랫폼 모두 padding으로
      // 메모 입력창을 키보드 위로 밀어올린다(탭바는 tabBarHideOnKeyboard로 숨겨짐).
      behavior="padding"
      style={styles.flex}
    >
      <ScreenBackground edges={['top']}>
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={items}
          keyExtractor={(i) => i.entry.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                haptics.tap();
                await load();
                if (mountedRef.current) setRefreshing(false);
              }}
              tintColor={colors.brand.primary}
              colors={[colors.brand.primary]}
            />
          }
          ListHeaderComponent={
            <TodayHeader
              viewDateObj={viewDateObj}
              isTodayDate={isTodayDate}
              viewMode={viewMode}
              decisionCount={decisionCount}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
              onToggleViewMode={() => setViewMode((m) => (m === 'list' ? 'diary' : 'list'))}
              onOpenArchive={() => router.navigate('/(tabs)/archive')}
              onOpenInbox={() => router.navigate('/(tabs)/inbox')}
            />
          }
          renderItem={({ item, index }) => (
            <AppearIn index={index}>
              {editMemoId === item.entry.id ? (
                <MemoEditor
                  value={memoDraft}
                  onChangeText={setMemoDraft}
                  onSave={handleSaveMemo}
                  onCancel={() => setEditMemoId(null)}
                />
              ) : viewMode === 'diary' ? (
                <EntryDiaryItem
                  entry={item.entry}
                  transcript={item.transcript}
                  decision={item.decision}
                  onPress={() => handlePressEntry(item)}
                />
              ) : (
                <EntryCard
                  entry={item.entry}
                  transcript={item.transcript}
                  decision={item.decision}
                  vaultConnected={vaultConnected}
                  onPress={() => handlePressEntry(item)}
                  onDelete={(opts) => handleDelete(item.entry, opts)}
                />
              )}
            </AppearIn>
          )}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.center}>
              {loading ? (
                <View style={styles.skeleton}>
                  <Shimmer width={200} height={150} />
                  <Shimmer width={140} height={16} />
                  <Shimmer width={200} height={14} />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <IllustrationSlot name="empty-today" placeholder={<EmptyMomentArt />} />
                  <AppText preset="bodyMedium" color={colors.text.tertiary} style={styles.emptyText}>
                    {isTodayDate ? '오늘의 첫 스냅을 남겨보세요' : '이 날의 기록이 없어요'}
                  </AppText>
                </View>
              )}
            </View>
          }
        />

        {/* 스크롤 이동 버튼 — 위치에 따라 위/아래 토글 */}
        <ScrollFab
          scrollPos={scrollPos}
          bottomOffset={composerH + spacing.md}
          onScrollTop={scrollToTop}
          onScrollBottom={scrollToBottom}
        />

        {/* 하단 입력 바 — 탭바 위에 고정 */}
        <TodayComposer
          memo={memo}
          addingMemo={addingMemo}
          onChangeMemo={setMemo}
          onSubmit={handleAddMemo}
          onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}
          onUpload={handleUpload}
          onAudio={() => router.push('/record-audio')}
          onCapture={() => router.push('/record')}
        />
      </ScreenBackground>

      {editingDecision && (
        <EditDecisionSheet
          key={editingDecision.id}
          visible
          decision={editingDecision}
          onCancel={() => setEditingDecision(null)}
          onSave={handleSaveDecisionEdit}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// 메모 인라인 편집기 — 항목 자리에서 바로 펼쳐 manual_note 수정
const MEMO_LINE_GAP = 28; // 메모지 괘선 간격 = 입력 줄높이

function MemoEditor(props: {
  value: string;
  onChangeText(v: string): void;
  onSave(): void;
  onCancel(): void;
}) {
  return (
    <View style={styles.memoCard}>
      {/* 메모지 괘선 위에 글씨 쓰는 느낌 */}
      <LinedPaper torn lineGap={MEMO_LINE_GAP} padding={spacing.md}>
        <TextInput
          style={styles.memoInput}
          value={props.value}
          onChangeText={props.onChangeText}
          multiline
          autoFocus
          textAlignVertical="top"
          placeholder="메모를 적어보세요…"
          placeholderTextColor={colors.text.tertiary}
        />
      </LinedPaper>
      <View style={styles.memoActions}>
        <Button label="취소" variant="quiet" size="sm" onPress={props.onCancel} />
        <Button label="저장" variant="primary" size="sm" onPress={props.onSave} disabled={!props.value.trim()} style={styles.flex1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1 },
  listContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: spacing.md,
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['5xl'] },
  emptyState: { alignItems: 'center', gap: spacing.lg },
  emptyText: { textAlign: 'center' },
  skeleton: { alignItems: 'center', gap: spacing.md },
  memoCard: { marginBottom: spacing.md, gap: spacing.sm },
  memoInput: {
    fontSize: 16, lineHeight: MEMO_LINE_GAP, color: colors.text.primary,
    padding: 0, minHeight: 84, textAlignVertical: 'top', backgroundColor: 'transparent',
  },
  memoActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
