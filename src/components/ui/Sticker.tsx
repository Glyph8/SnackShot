import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  /** 스티커 바탕(기본 스티키 태그 노랑) */
  bg?: string;
  /** 글자색 */
  color?: string;
  /** 기울임 각도(도, 기본 -6) */
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 붙여둔 스티커 — 둥근 라벨 + 살짝 기울임 + 떠 있는 그림자. "할 일을 알리는 쪽지" 용도.
 * 색은 토큰 경유. 보통 카드 위 inline 또는 모서리에 얹는다.
 */
export function Sticker({ label, bg = colors.accent.tagBg, color = colors.accent.tagText, tilt = -6, style }: Props) {
  return (
    <View style={[styles.sticker, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <AppText preset="tag" color={color}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    ...shadow.card,
  },
});
