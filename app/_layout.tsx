import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getEntriesPage } from '@/db';
import { runMigrations } from '@/db/migrations';
import { getSttService } from '@/services/stt';
import { startWorker, stopWorker } from '@/services/jobs/queue';

// SQLiteProvider 안에서 db를 가져와 워커를 시작.
// DB 초기화(runMigrations) 완료 후 실행이 보장됨.
function WorkerStarter() {
  const db = useSQLiteContext();
  useEffect(() => {
    startWorker(db);
    return stopWorker;
  }, [db]);
  return null;
}

// ─── TEMP — Phase 2 Step 2 검증용 ────────────────────────────────────────────
// RUN_TRANSCRIBE_TEST = true 로 바꾸고 리로드하면 최신 Entry의 originalPath로
// Whisper를 호출해 한국어 텍스트가 콘솔에 출력되는지 확인.
// 검증 후 false로 되돌릴 것.
// Whisper 무료 한도: 60분. 파일 크기 25MB 이하.
const RUN_TRANSCRIBE_TEST = false;

function DevTranscribeTest() {
  const db = useSQLiteContext();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!RUN_TRANSCRIBE_TEST || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // 가장 최근 Entry 1개 조회
        const entries = await getEntriesPage(db, Date.now() + 86_400_000, 1);
        const entry = entries[0];
        if (!entry) {
          console.log('[DEV TEST] Entry 없음 — 먼저 클립을 녹화/저장하세요.');
          return;
        }
        const audioPath = entry.compressedPath ?? entry.originalPath;
        console.log(`[DEV TEST] transcribe 시작 id=${entry.id} path=${audioPath}`);
        const result = await getSttService().transcribe(audioPath);
        console.log('[DEV TEST] 결과:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.error('[DEV TEST] 오류:', e);
      }
    })();
  }, [db]);

  return null;
}
// ─── /TEMP ───────────────────────────────────────────────────────────────────

function DbLoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export default function RootLayout() {
  return (
    <Suspense fallback={<DbLoadingFallback />}>
      <SQLiteProvider databaseName="snackshot.db" onInit={runMigrations} useSuspense>
        <WorkerStarter />
        <DevTranscribeTest />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="record" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="preview" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
