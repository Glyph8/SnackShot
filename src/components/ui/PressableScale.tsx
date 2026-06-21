import type { ReactNode } from 'react';
import { useRef } from 'react';
import {
  Animated, Pressable, type AccessibilityRole, type StyleProp, type ViewStyle,
} from 'react-native';

import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { spring } from '@/theme';

type HapticName = keyof typeof haptics;

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** press 시 줄어드는 비율(기본 0.96) */
  scaleTo?: number;
  /** press 시 발생할 촉각 어휘(선택) */
  haptic?: HapticName;
  disabled?: boolean;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  /** 외곽 Pressable에 적용(레이아웃용 — 예: flex) */
  containerStyle?: StyleProp<ViewStyle>;
  /** 시각 박스(Animated.View)에 적용 — 스케일이 걸리는 대상 */
  style?: StyleProp<ViewStyle>;
}

/** press 시 살짝 눌리는 스프링 피드백 버튼. 동작 줄이기 시 스케일 없이 동작. */
export function PressableScale({
  children, onPress, scaleTo = 0.96, haptic, disabled, hitSlop,
  accessibilityLabel, accessibilityRole, containerStyle, style,
}: Props) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (reduce) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, ...spring.stiff }).start();
  };
  return (
    <Pressable
      onPress={() => { if (haptic) haptics[haptic](); onPress?.(); }}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={containerStyle}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
