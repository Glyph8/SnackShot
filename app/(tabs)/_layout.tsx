import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
        // 키보드가 올라오면 탭바를 숨겨 today 입력창과 겹치지 않게 한다
        tabBarHideOnKeyboard: true,
        // 시스템 내비게이션 바(제스처/3버튼) 영역만큼 하단 inset 확보.
        // ⚠️ paddingBottom은 직접 덮어쓰지 않는다 — react-navigation v7이 insets.bottom으로
        //    자동 처리한다. 여기서 덮어쓰면 레이아웃 시점 insets.bottom이 0일 때(edge-to-edge
        //    초기/제스처 내비 타이밍) 하단 패딩이 무너져 탭바가 시스템 바에 가려진다.
        tabBarStyle: {
          backgroundColor: colors.surface.paper,
          borderTopColor: colors.border.hairline,
          height: layout.tabBarHeight + insets.bottom,
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
  );
}
