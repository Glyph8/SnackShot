import { Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { useInboxStore } from '@/stores/inbox';
import { useTodayStore } from '@/stores/today';

export default function TabsLayout() {
  const db = useSQLiteContext();
  const resetToToday = useTodayStore((s) => s.resetToToday);
  const { badgeCount, loadBadge } = useInboxStore();

  useEffect(() => {
    loadBadge(db);
  }, [db, loadBadge]);

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="today"
        options={{ title: 'Today' }}
        listeners={{ tabPress: () => { resetToToday(); } }}
      />
      <Tabs.Screen name="archive" options={{ title: 'Archive' }} />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
