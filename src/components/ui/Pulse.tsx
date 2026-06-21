import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/motion';
import { duration } from '@/theme';

interface Props {
  children: ReactNode;
  /** 맥동 활성화(기본 true). false면 정지·원래 크기 */
  active?: boolean;
  /** 최대 확대 비율(기본 1.18) */
  maxScale?: number;
  style?: StyleProp<ViewStyle>;
}

/** 호흡하듯 맥동(녹화 표시등·진행 인디케이터 등). 동작 줄이기 시 정지. */
export function Pulse({ children, active = true, maxScale = 1.18, style }: Props) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduce) { v.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration.slow, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: duration.slow, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduce, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, maxScale] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
  return (
    <Animated.View style={[{ transform: [{ scale }], opacity }, style]}>
      {children}
    </Animated.View>
  );
}
