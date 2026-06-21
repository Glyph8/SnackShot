import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/motion';
import { colors, duration, radius as radii } from '@/theme';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 스켈레톤 로딩 블록 — sunken 바탕 위로 밝은 종이색 띠가 가로로 쓸고 지나간다.
 * 동작 줄이기 시 정적 블록만 표시. 색은 토큰 경유.
 */
export function Shimmer({ width = '100%', height = 16, radius = radii.sm, style }: Props) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const onLayout = (e: LayoutChangeEvent) => {
    const width2 = e.nativeEvent.layout.width;
    if (width2 !== w) setW(width2);
  };
  useEffect(() => {
    if (reduce || w === 0) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: duration.slow * 3, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, w, x]);
  const bandW = Math.max(w * 0.4, 40);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-bandW, w] });
  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface.sunken, overflow: 'hidden' }, style]}
    >
      {!reduce && w > 0 && (
        <Animated.View
          style={{
            position: 'absolute', top: 0, bottom: 0, width: bandW,
            backgroundColor: colors.surface.paperRaised, opacity: 0.7,
            transform: [{ translateX }],
          }}
        />
      )}
    </View>
  );
}
