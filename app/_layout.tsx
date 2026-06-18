import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { runMigrations } from '@/db/migrations';
import { startWorker, stopWorker } from '@/services/jobs/queue';
import { exportWidgetDecisions, syncWidget } from '@/services/widget/widgetSync';
import { fontAssets } from '@/theme/fonts';

// SQLiteProvider 안에서 db를 가져와 워커를 시작.
// DB 초기화(runMigrations) 완료 후 실행이 보장됨.
function WorkerStarter() {
  const db = useSQLiteContext();
  useEffect(() => {
    startWorker(db);
    // 위젯 동기화: 시작 시 + 포그라운드 복귀 시 pending 반영·export, 백그라운드 진입 시 export
    syncWidget(db);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncWidget(db);
      else if (state === 'background') exportWidgetDecisions(db);
    });
    return () => {
      sub.remove();
      stopWorker();
    };
  }, [db]);
  return null;
}

function DbLoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export default function RootLayout() {
  // 폰트 로드 — fontAssets가 비어 있으면 즉시 true로 폴백(시스템 폰트).
  // assets/fonts에 파일 추가 + src/theme/fonts.ts require 해제 시 자동 적용.
  const [fontsLoaded] = useFonts(fontAssets);
  if (!fontsLoaded) return <DbLoadingFallback />;

  return (
    <Suspense fallback={<DbLoadingFallback />}>
      <SQLiteProvider databaseName="snackshot.db" onInit={runMigrations} useSuspense>
        <WorkerStarter />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="record" options={{ presentation: 'fullScreenModal', orientation: 'all' }} />
          <Stack.Screen name="preview" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="compose-text" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="compose-decision" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="decisions" />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
