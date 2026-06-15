import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  /** 배경색 (기본 스티키 옐로) */
  bg?: string;
  /** 글자색 (기본 잉크) */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** 스티키 태그(할일/약속 등 카테고리). 색은 항상 텍스트와 동반(색각 보조). */
export function Tag({ label, bg = colors.accent.tagBg, color = colors.accent.tagText, style }: Props) {
  return (
    <View style={[styles.base, { backgroundColor: bg }, style]}>
      <AppText preset="tag" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
