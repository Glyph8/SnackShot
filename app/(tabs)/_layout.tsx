import { Tabs } from 'expo-router';

import { useTodayStore } from '@/stores/today';

export default function TabsLayout() {
  const resetToToday = useTodayStore((s) => s.resetToToday);
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="today"
        options={{ title: 'Today' }}
        listeners={{ tabPress: () => { resetToToday(); } }}
      />
      <Tabs.Screen name="archive" options={{ title: 'Archive' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
