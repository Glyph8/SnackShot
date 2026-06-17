import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, iconSize, radius, shadow, spacing } from '@/theme';

// today.tsx에서 분리 (P3). 스크롤 위/아래 이동 FAB — 순수 프레젠테이션.

export type ScrollPos = 'top' | 'middle' | 'bottom' | 'none';

export interface ScrollFabProps {
  scrollPos: ScrollPos;
  bottomOffset: number;
  onScrollTop(): void;
  onScrollBottom(): void;
}

export function ScrollFab({ scrollPos, bottomOffset, onScrollTop, onScrollBottom }: ScrollFabProps) {
  if (scrollPos === 'none') return null;
  return (
    <View style={[styles.scrollFab, { bottom: bottomOffset }]} pointerEvents="box-none">
      {scrollPos !== 'top' && (
        <Pressable style={styles.fabBtn} onPress={onScrollTop}>
          <Ionicons name="arrow-up" size={iconSize.md} color={colors.text.secondary} />
        </Pressable>
      )}
      {scrollPos !== 'bottom' && (
        <Pressable style={styles.fabBtn} onPress={onScrollBottom}>
          <Ionicons name="arrow-down" size={iconSize.md} color={colors.text.secondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollFab: { position: 'absolute', right: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  fabBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.surface.paperRaised,
    borderWidth: 1, borderColor: colors.border.card,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
});
