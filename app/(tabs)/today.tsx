/** @codemap 오늘 탭(/today) — 하루 단위 Entry 목록 · 녹화/작성 진입
 *  데이터: @/db(entries 등) · 삭제 services/deleteEntry · 잡 services/jobs/queue · 상태 stores/today
 *  관련 ADR: 003(클립 1급), 013(시각) · 형제: archive, inbox, entry/[id]
 */
import { Ionicons } from '@expo/vector-icons';
import { addDays, addHours, format, isToday, parseISO, startOfDay, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  type NativeScrollEvent, type NativeSyntheticEvent,
  Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native';

import { CaptureBar } from '@/components/CaptureBar';
import { EntryCard } from '@/components/EntryCard';
import { EntryDiaryItem } from '@/components/EntryDiaryItem';
import { AppText, Pin, ScreenBackground } from '@/components/ui';
import {
  countExtractedDecisions, enqueueJob, getEntriesByDay, getLatestTranscript,
  getSettings, insertTextEntry,
} from '@/db';
import { getDayBoundary } from '@/lib/time';
import { deleteEntryWithCleanup } from '@/services/deleteEntry';
import { kickWorker } from '@/services/jobs/queue';
import { useTodayStore } from '@/stores/today';
import { colors, iconSize, layout, radius, shadow, spacing } from '@/theme';
import type { Entry, Transcript } from '@/types/domain';

type ViewMode = 'list' | 'diary';

interface Item {
  entry: Entry;
  transcript: Transcript | null;
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
  const [composerH, setComposerH] = useState(0);
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

  // 메모를 Today에서 바로 작성·추가 (별도 페이지 없이 인라인 insert)
  const handleAddMemo = useCallback(async () => {
    const text = memo.trim();
    if (!text || addingMemo) return;
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

  const header = (
    <View>
      <AppText preset="caption" color={colors.text.secondary} style={styles.dateLine}>
        {format(viewDateObj, 'yyyy년 M월 d일 EEEE', { locale: ko })}
      </AppText>

      <View style={styles.titleRow}>
        <View style={styles.navRow}>
          <Pressable onPress={handlePrevDay} hitSlop={spacing.md}>
            <Ionicons name="chevron-back" size={iconSize.md} color={colors.text.tertiary} />
          </Pressable>
          <AppText preset="displayLarge">{isTodayDate ? '오늘의 일기' : format(viewDateObj, 'M월 d일')}</AppText>
          <Pressable onPress={handleNextDay} hitSlop={spacing.md} disabled={isTodayDate}>
            <Ionicons
              name="chevron-forward"
              size={iconSize.md}
              color={isTodayDate ? colors.border.dashed : colors.text.tertiary}
            />
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setViewMode((m) => (m === 'list' ? 'diary' : 'list'))} hitSlop={spacing.sm}>
            <AppText preset="caption" color={colors.text.link}>
              {viewMode === 'list' ? '일기 보기' : '목록 보기'}
            </AppText>
          </Pressable>
          <Pressable onPress={() => router.navigate('/(tabs)/archive')} hitSlop={spacing.sm}>
            <Ionicons name="search" size={iconSize.md} color={colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      {decisionCount > 0 && (
        <Pressable onPress={() => router.navigate('/(tabs)/inbox')} style={styles.banner}>
          <Pin size={16} style={styles.bannerPin} />
          <AppText preset="bodyMedium" color={colors.text.primary} style={styles.bannerText}>
            {`오늘 기록에서 결정 ${decisionCount}건을 찾았어요 — Inbox에서 확인!`}
          </AppText>
        </Pressable>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScreenBackground edges={['top']}>
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={items}
          keyExtractor={(i) => i.entry.id}
          ListHeaderComponent={header}
          renderItem={({ item }) =>
            viewMode === 'diary' ? (
              <EntryDiaryItem
                entry={item.entry}
                transcript={item.transcript}
                onPress={() => router.push(`/entry/${item.entry.id}`)}
              />
            ) : (
              <EntryCard
                entry={item.entry}
                transcript={item.transcript}
                vaultConnected={vaultConnected}
                onPress={() => router.push(`/entry/${item.entry.id}`)}
                onDelete={(opts) => handleDelete(item.entry, opts)}
              />
            )
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.center}>
              {loading ? (
                <ActivityIndicator color={colors.brand.primary} />
              ) : (
                <AppText preset="bodyMedium" color={colors.text.tertiary}>
                  {isTodayDate ? '오늘의 첫 스냅을 남겨보세요' : '이 날의 기록이 없어요'}
                </AppText>
              )}
            </View>
          }
        />

        {/* 스크롤 이동 버튼 — 위치에 따라 위/아래 토글 */}
        {scrollPos !== 'none' && (
          <View style={[styles.scrollFab, { bottom: composerH + spacing.md }]} pointerEvents="box-none">
            {scrollPos !== 'top' && (
              <Pressable style={styles.fabBtn} onPress={scrollToTop}>
                <Ionicons name="arrow-up" size={iconSize.md} color={colors.text.secondary} />
              </Pressable>
            )}
            {scrollPos !== 'bottom' && (
              <Pressable style={styles.fabBtn} onPress={scrollToBottom}>
                <Ionicons name="arrow-down" size={iconSize.md} color={colors.text.secondary} />
              </Pressable>
            )}
          </View>
        )}

        {/* 하단 입력 바 — 탭바 위에 고정 */}
        <View
          style={[styles.composer, { paddingBottom: spacing.sm }]}
          onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}
        >
          <View style={styles.memoRow}>
            <Ionicons name="create-outline" size={iconSize.md} color={colors.text.tertiary} />
            <TextInput
              style={styles.memoInput}
              placeholder="오늘 한 줄, 직접 쓰기…"
              placeholderTextColor={colors.text.tertiary}
              value={memo}
              onChangeText={setMemo}
              onSubmitEditing={handleAddMemo}
              returnKeyType="done"
              blurOnSubmit
              editable={!addingMemo}
            />
            {memo.trim().length > 0 && (
              <Pressable onPress={handleAddMemo} disabled={addingMemo} hitSlop={spacing.sm} style={styles.sendBtn}>
                {addingMemo
                  ? <ActivityIndicator size="small" color={colors.brand.onPrimary} />
                  : <Ionicons name="arrow-up" size={iconSize.md} color={colors.brand.onPrimary} />}
              </Pressable>
            )}
          </View>
          <CaptureBar onUpload={handleUpload} onAudio={() => router.push('/record-audio')} onVideo={() => router.push('/record')} />
        </View>
      </ScreenBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: spacing.md,
  },
  dateLine: { marginTop: layout.headerPaddingTop },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.xs, marginBottom: spacing.lg,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.accent.highlight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.dashed,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerPin: { marginTop: -spacing.xs },
  bannerText: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['5xl'] },

  // 하단 고정 입력 바
  composer: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.hairline,
  },
  memoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface.sunken,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: layout.minTouch,
  },
  memoInput: { flex: 1, fontSize: 15, color: colors.text.primary, padding: 0 },
  sendBtn: {
    width: 32, height: 32, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // 스크롤 이동 FAB
  scrollFab: { position: 'absolute', right: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  fabBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.surface.paperRaised,
    borderWidth: 1, borderColor: colors.border.card,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
});
