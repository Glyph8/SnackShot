import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type ActionItem, Icon } from '@/components/ui';
import { colors, iconSize, layout, radius, shadow, spacing } from '@/theme';

// 글로벌 퀵캡처 — 어느 탭에서도 1탭으로 녹화/녹음/작성 진입.
// Today에는 이미 하단 캡처 컴포저가 있어 중복·충돌을 피하려고 숨긴다.
export function QuickCaptureFab() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === '/today' || pathname === '/') return null;

  const bottomReserve = Math.max(insets.bottom, layout.navBarFallback);
  const items: ActionItem[] = [
    { label: '영상 녹화', icon: 'videocam', onPress: () => router.push('/record') },
    { label: '음성 녹음', icon: 'mic', onPress: () => router.push('/record-audio') },
    { label: '글로 남기기', icon: 'create', onPress: () => router.push('/compose-text') },
  ];

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.wrap, { bottom: layout.tabBarHeight + bottomReserve + spacing.md }]}
      >
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityLabel="빠른 캡처"
        >
          <Icon name="add" size={iconSize.lg} color={colors.brand.onPrimary} />
        </Pressable>
      </View>
      <ActionSheet visible={open} onClose={() => setOpen(false)} items={items} title="새 기록" />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: layout.screenPaddingX, alignItems: 'flex-end' },
  fab: {
    width: 56, height: 56, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center',
    ...shadow.floating,
  },
  fabPressed: { backgroundColor: colors.brand.primaryPressed },
});
