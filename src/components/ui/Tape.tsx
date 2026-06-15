import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, opacity, radius } from '@/theme';

interface Props {
  width?: number;
  height?: number;
  color?: string;
  /** 기울임 각도(도) */
  angle?: number;
  /** 위치 지정용 (보통 absolute) */
  style?: StyleProp<ViewStyle>;
}

/** 마스킹 테이프 장식. 폴라로이드 상단 등에 붙인다. */
export function Tape({ width = 64, height = 22, color = colors.accent.tape, angle = -4, style }: Props) {
  return (
    <View
      style={[
        styles.base,
        { width, height, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    opacity: opacity.muted,
  },
});
