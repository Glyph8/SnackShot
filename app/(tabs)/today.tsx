import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  SafeAreaView, StyleSheet, Text, View,
} from 'react-native';

import { EntryCard } from '@/components/EntryCard';
import { getEntriesByDay, getLatestTranscript, getSettings } from '@/db';
import { getDayBoundary } from '@/lib/time';
import type { Entry, Transcript } from '@/types/domain';

interface Item {
  entry: Entry;
  transcript: Transcript | null;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const load = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const { dayBoundaryHour } = await getSettings(db);
      const { start, end } = getDayBoundary(Date.now(), dayBoundaryHour);
      const entries = await getEntriesByDay(db, start, end);
      const loaded = await Promise.all(
        entries.map(async (entry) => ({
          entry,
          transcript: await getLatestTranscript(db, entry.id),
        })),
      );
      setItems(loaded);
    } catch (e) {
      console.error('[today] load failed', e);
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, [db]);

  // 탭 포커스마다 재로드 — 저장 후 즉시 반영
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 압축/STT 처리 중인 항목이 있으면 3초마다 폴링 — 진행 상태 실시간 반영
  const hasActiveJobs = items.some(
    (i) =>
      i.entry.compressionStatus === 'pending' ||
      i.entry.compressionStatus === 'processing',
  );
  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = setInterval(() => load(), 3_000);
    return () => clearInterval(id);
  }, [hasActiveJobs, load]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Today</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#888" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.entry.id}
          renderItem={({ item }) => (
            <EntryCard
              entry={item.entry}
              transcript={item.transcript}
              onPress={() => router.push(`/entry/${item.entry.id}`)}
            />
          )}
          contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>오늘의 첫 스냅을 남겨보세요</Text>
            </View>
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/record')}>
        <View style={styles.fabDot} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '500', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 15, color: '#aaa' },
  emptyContent: { flex: 1 },
  listContent: { paddingBottom: 110 },
  fab: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  fabDot: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#000' },
});
