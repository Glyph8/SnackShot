import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { runMigrations } from '@/db/migrations';
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
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="record" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="preview" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="compose-text" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
