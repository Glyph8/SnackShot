import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layoutAnimate } from '@/lib/motion';
import { colors, iconSize, radius, spacing } from '@/theme';

import { AppText } from './AppText';

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** 우측에 표시할 보조 텍스트(예: 요약) */
  hint?: string;
}

/** 접고 펼치는 설정 섹션. 기본 접힘. */
export function CollapsibleSection({ title, children, defaultOpen = false, hint }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    layoutAnimate();
    setOpen((v) => !v);
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.header} onPress={toggle}>
        <AppText preset="titleMedium" style={styles.title}>{title}</AppText>
        {hint && !open && (
          <AppText preset="caption" color={colors.text.tertiary} numberOfLines={1} style={styles.hint}>
            {hint}
          </AppText>
        )}
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={iconSize.md}
          color={colors.text.tertiary}
        />
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.card,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
  },
  title: { flex: 1 },
  hint: { flexShrink: 1 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
