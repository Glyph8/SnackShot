import { addDays, addHours, format, isToday, parseISO, startOfDay, subDays } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EntryCard } from '@/components/EntryCard';
import { EntryDiaryItem } from '@/components/EntryDiaryItem';
import { getEntriesByDay, getLatestTranscript, getSettings, softDeleteEntry } from '@/db';
import { deleteEntryFiles } from '@/lib/storage';
import { getDayBoundary } from '@/lib/time';
import { useTodayStore } from '@/stores/today';
import type { Entry, Transcript } from '@/types/domain';

type ViewMode = 'list' | 'diary';

interface Item {
  entry: Entry;
  transcript: Transcript | null;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { viewDate, setViewDate } = useTodayStore();
  const viewDateObj = parseISO(viewDate);

  const [viewMode, setViewMode] = useState<ViewMode>('diary');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
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
      const { dayBoundaryHour } = await getSettings(db);
      const noonMs = addHours(startOfDay(parseISO(viewDate)), 12).getTime();
      const { start, end } = getDayBoundary(noonMs, dayBoundaryHour);
      const entries = await getEntriesByDay(db, start, end);
      const loaded = await Promise.all(
        entries.map(async (entry) => ({
          entry,
          transcript: await getLatestTranscript(db, entry.id),
        })),
      );
      if (mountedRef.current) setItems(loaded);
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
      params: {
        uri: result.assets[0].uri,
        durationMs: 0,       // preview에서 player.duration으로 보완
        recordedAt: Date.now(),
      },
    });
  }, []);

  const handleDelete = useCallback(
    async (entry: Entry, deleteFiles: boolean) => {
      await softDeleteEntry(db, entry.id);
      if (deleteFiles) deleteEntryFiles(entry);
      setItems((prev) => prev.filter((i) => i.entry.id !== entry.id));
    },
    [db],
  );

  // 처리 중인 항목이 있으면 3초마다 폴링 — 압축/STT 완료 즉시 반영
  const hasActiveJobs = items.some(
    (i) =>
      i.entry.compressionStatus === 'pending' ||
      i.entry.compressionStatus === 'processing' ||
      i.entry.sttStatus === 'pending' ||
      i.entry.sttStatus === 'processing',
  );
  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = setInterval(() => load(), 3_000);
    return () => clearInterval(id);
  }, [hasActiveJobs, load]);

  const isTodayDate = isToday(viewDateObj);
  const titleLabel = isTodayDate ? 'Today' : format(viewDateObj, 'M월 d일');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleRow}>
        {/* 날짜 네비게이션 */}
        <View style={styles.navRow}>
          <Pressable onPress={handlePrevDay} hitSlop={12} style={styles.navBtn}>
            <Text style={styles.navBtnTxt}>‹</Text>
          </Pressable>
          <Text style={styles.title}>{titleLabel}</Text>
          <Pressable
            onPress={handleNextDay}
            hitSlop={12}
            style={[styles.navBtn, isTodayDate && styles.navBtnDisabled]}
            disabled={isTodayDate}
          >
            <Text style={[styles.navBtnTxt, isTodayDate && styles.navBtnTxtDisabled]}>›</Text>
          </Pressable>
        </View>

        {/* 오른쪽 액션 */}
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setViewMode((m) => m === 'list' ? 'diary' : 'list')}
            hitSlop={12}
          >
            <Text style={styles.modeToggleTxt}>
              {viewMode === 'list' ? '일기 보기' : '목록 보기'}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.navigate('/(tabs)/archive')} hitSlop={12}>
            <Text style={styles.searchBtn}>검색</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#888" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.entry.id}
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
                onPress={() => router.push(`/entry/${item.entry.id}`)}
                onDelete={(del) => handleDelete(item.entry, del)}
              />
            )
          }
          contentContainerStyle={
            items.length === 0 ? styles.emptyContent : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {isTodayDate ? '오늘의 첫 스냅을 남겨보세요' : '이 날의 기록이 없어요'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB 행: 파일 업로드 · 녹음 · 녹화 */}
      <View style={styles.fabRow}>
        <Pressable style={styles.uploadFab} onPress={handleUpload}>
          <Text style={styles.uploadFabTxt}>파일</Text>
        </Pressable>
        <Pressable style={styles.audioFab} onPress={() => router.push('/record-audio')}>
          <Text style={styles.audioFabTxt}>🎤</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => router.push('/record')}>
          <View style={styles.fabDot} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  navBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.25 },
  navBtnTxt: { fontSize: 22, color: '#111', lineHeight: 26 },
  navBtnTxtDisabled: { color: '#aaa' },
  title: { fontSize: 22, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  modeToggleTxt: { fontSize: 13, color: '#888', fontWeight: '500' },
  searchBtn: { fontSize: 14, color: '#888', fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 15, color: '#aaa' },
  emptyContent: { flex: 1 },
  listContent: { paddingBottom: 110 },
  fabRow: {
    position: 'absolute', bottom: 32,
    left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18,
  },
  fab: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  fabDot: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#000' },
  uploadFab: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: '#999',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadFabTxt: { fontSize: 11, color: '#555', fontWeight: '700', letterSpacing: 0.3 },
  audioFab: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: '#333',
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  audioFabTxt: { fontSize: 22 },
});
