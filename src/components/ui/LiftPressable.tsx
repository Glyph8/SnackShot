import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { spring } from '@/theme';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** 길게 누르면 호출 — 보통 빠른 액션 시트 오픈 */
  onLongPress?: () => void;
  /** 들어올리는 비율(기본 1.04) */
  liftTo?: number;
  delayLongPress?: number;
  /** 외곽 Pressable에 적용(레이아웃용) */
  containerStyle?: StyleProp<ViewStyle>;
  /** 시각 박스(Animated.View)에 적용 */
  style?: StyleProp<ViewStyle>;
}

/**
 * 길게 누르면 카드가 "집어 올려지는" 피드백(scale↑ + impact 햅틱) 후 onLongPress 실행.
 * 손을 떼면 스프링으로 복귀. 동작 줄이기 시 모션 없이 햅틱만. (탭=onPress)
 */
export function LiftPressable({
  children, onPress, onLongPress, liftTo = 1.04, delayLongPress = 250, containerStyle, style,
}: Props) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number, cfg: { stiffness: number; damping: number; mass: number }) => {
    if (reduce) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, ...cfg }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        haptics.impact();
        animate(liftTo, spring.bouncy);
        onLongPress?.();
      }}
      onPressOut={() => animate(1, spring.soft)}
      delayLongPress={delayLongPress}
      style={containerStyle}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
