import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { useInboxStore } from '@/stores/inbox';
import { useTodayStore } from '@/stores/today';
import { colors, fontFamily, iconSize } from '@/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(focused: boolean, name: IoniconsName, outlineName: IoniconsName) {
  return (
    <Ionicons
      name={focused ? name : outlineName}
      size={iconSize.tab}
      color={focused ? colors.brand.primary : colors.text.tertiary}
    />
  );
}

export default function TabsLayout() {
  const db = useSQLiteContext();
  const resetToToday = useTodayStore((s) => s.resetToToday);
  const { badgeCount, loadBadge } = useInboxStore();

  useEffect(() => {
    loadBadge(db);
  }, [db, loadBadge]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.surface.paper,
          borderTopColor: colors.border.hairline,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.body },
        tabBarBadgeStyle: {
          backgroundColor: colors.brand.primary,
          color: colors.brand.onPrimary,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'today', 'today-outline'),
        }}
        listeners={{ tabPress: () => { resetToToday(); } }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Archive',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'film', 'film-outline'),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
          tabBarIcon: ({ focused }) => tabIcon(focused, 'mail', 'mail-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'settings', 'settings-outline'),
        }}
      />
    </Tabs>
  );
}
