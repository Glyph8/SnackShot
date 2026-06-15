import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow } from '@/theme';

interface Props {
  /** 지름 (기본 18) */
  size?: number;
  color?: string;
  /** 위치 지정용 (보통 absolute) */
  style?: StyleProp<ViewStyle>;
}

/** 압정 장식. "꽂아둔 기록" 은유. 보통 카드 위 absolute 배치. */
export function Pin({ size = 18, color = colors.accent.pin, style }: Props) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    >
      <View
        style={[
          styles.gloss,
          { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, top: size * 0.2, left: size * 0.22 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', ...shadow.pin },
  gloss: { position: 'absolute', borderRadius: radius.pill, backgroundColor: colors.accent.pinGloss },
});
