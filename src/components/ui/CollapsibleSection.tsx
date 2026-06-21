import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { layoutAnimate, useReducedMotion } from '@/lib/motion';
import { colors, duration, iconSize, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { Receipt } from './Receipt';

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** 우측에 표시할 보조 텍스트(예: 요약) */
  hint?: string;
}

/** 펼칠 때 롤에서 풀려 내려오는 듯한 등장(위에서 아래로 슬라이드+페이드). 동작 줄이기 시 즉시 표시. */
function Unroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: duration.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, v]);
  // 위(롤 밑)에서 풀려 내려오는 느낌 — 살짝 위에서 시작해 제자리로 + 위가 먼저 펴지듯 살짝 늘어남
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-22, 0] });
  const scaleY = v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  return (
    <Animated.View style={[styles.body, { opacity: v, transform: [{ translateY }, { scaleY }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * 접고 펼치는 설정 섹션 — 돌돌 말린 영수증(`Receipt`) 위에 검정 잉크로 인쇄한 항목.
 * 누르면 높이(`layoutAnimate`) + 본문이 롤에서 풀려 내려오는 등장(`Unroll`)으로 펴진다. 기본 접힘.
 */
export function CollapsibleSection({ title, children, defaultOpen = false, hint }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    layoutAnimate(duration.base);
    setOpen((v) => !v);
  };

  return (
    <Receipt>
      <Pressable style={styles.header} onPress={toggle}>
        <AppText preset="titleMedium" color={colors.text.primary} style={styles.title}>{title}</AppText>
        {hint && !open && (
          <AppText preset="caption" color={colors.text.secondary} numberOfLines={1} style={styles.hint}>
            {hint}
          </AppText>
        )}
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={iconSize.md}
          color={colors.text.primary}
        />
      </Pressable>
      {open && <Unroll>{children}</Unroll>}
    </Receipt>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingTop: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg,
  },
  title: { flex: 1 },
  hint: { flexShrink: 1 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
