import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { HandDrawnBorder } from './HandDrawnBorder';

interface Props {
  label: string;
  /** 도장이 찍힌(선택) 상태 */
  selected: boolean;
  /** 찍혔을 때 잉크 색 */
  color: string;
  /** 찍혔을 때 옅은 배경 틴트 */
  tint: string;
  onPress(): void;
  style?: StyleProp<ViewStyle>;
}

/**
 * 도장(스탬프) 토글 버튼. 미선택은 **점선 테두리 + 회색조**(찍을 수 있음 신호),
 * 선택되면 잉크 색 손그림 테두리 + 옅은 틴트 + 살짝 비스듬히 찍힌 모습. 색은 토큰 경유.
 */
export function StampButton({ label, selected, color, tint, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.base,
        selected && { backgroundColor: tint, transform: [{ rotate: '-3deg' }] },
        style,
      ]}
    >
      <HandDrawnBorder
        shape="box"
        dashed={!selected}
        color={selected ? color : colors.border.dashed}
        radius={radius.xs}
        strokeWidth={selected ? 2 : 1.5}
      />
      <AppText preset="button" color={selected ? color : colors.text.tertiary}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
