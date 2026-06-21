import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/motion';
import { duration } from '@/theme';

interface Props {
  children: ReactNode;
  /** 리스트 stagger용 순번 — index * 60ms 만큼 지연 */
  index?: number;
  /** 시작 시 아래로 밀린 거리(px, 기본 14) */
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/** 마운트 시 페이드 + 아래→제자리 등장. 리스트는 index로 stagger. 동작 줄이기 시 즉시 표시. */
export function AppearIn({ children, index = 0, distance = 14, style }: Props) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: duration.base,
      // 긴 리스트에서 지연이 과해지지 않도록 상한(스크롤 마운트 지연 방지)
      delay: Math.min(index, 6) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, index, v]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
