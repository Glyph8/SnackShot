import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickCaptureFab } from '@/components/QuickCaptureFab';
import { useInboxStore } from '@/stores/inbox';
import { useTodayStore } from '@/stores/today';
import { colors, fontFamily, iconSize, layout, spacing } from '@/theme';

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
  const insets = useSafeAreaInsets();
  // 시스템 내비 영역 확보 — 일부 edge-to-edge 기기에서 insets.bottom이 0으로 잡혀
  // 라벨이 시스템 바에 가려지는 문제가 있어 최소값을 보장한다.
  const bottomReserve = Math.max(insets.bottom, layout.navBarFallback);
  const resetToToday = useTodayStore((s) => s.resetToToday);
  const { badgeCount, loadBadge } = useInboxStore();

  useEffect(() => {
    loadBadge(db);
  }, [db, loadBadge]);

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        // 키보드가 올라오면 탭바를 숨겨 today 입력창과 겹치지 않게 한다
        tabBarHideOnKeyboard: true,
        // 콘텐츠 높이(아이콘+라벨) + 하단 reserve(시스템 내비)를 명시해 라벨이 잘리지 않게 한다.
        tabBarStyle: {
          backgroundColor: colors.surface.paper,
          borderTopColor: colors.border.hairline,
          height: layout.tabBarHeight + bottomReserve,
          paddingBottom: bottomReserve,
          paddingTop: spacing.xs,
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
    <QuickCaptureFab />
    </>
  );
}
