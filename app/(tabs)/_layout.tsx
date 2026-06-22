import { Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickCaptureFab } from '@/components/QuickCaptureFab';
import { Icon, type IconName } from '@/components/ui';
import { useInboxStore } from '@/stores/inbox';
import { useTodayStore } from '@/stores/today';
import { colors, fontFamily, iconSize, layout, spacing } from '@/theme';

function tabIcon(focused: boolean, name: IconName) {
  return (
    <Icon
      name={name}
      active={focused}
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
        // 탭 전환은 즉시 전환(none) — 크로스페이드는 무거운 화면과 겹쳐 흰 화면·버벅임을 유발해 비활성화
        animation: 'none',
        // 블러된 탭을 얼리지 않음 — 복귀 시 흰 화면(thaw 지연)을 막는다
        freezeOnBlur: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        // tabBarHideOnKeyboard는 KeyboardAvoidingView와 이중 애니메이션을 일으켜(키보드 내릴 때
        // 입력 바가 한 번 튀는 버벅임) 비활성화 — 각 화면의 KAV가 입력창을 키보드 위로 올린다.
        tabBarHideOnKeyboard: false,
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
          tabBarIcon: ({ focused }) => tabIcon(focused, 'today'),
        }}
        listeners={{ tabPress: () => { resetToToday(); } }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Archive',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'archive'),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
          tabBarIcon: ({ focused }) => tabIcon(focused, 'inbox'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'settings'),
        }}
      />
    </Tabs>
    <QuickCaptureFab />
    </>
  );
}
