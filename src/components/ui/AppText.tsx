import { Text, type TextProps } from 'react-native';

import { colors, textPresets, type TextPresetKey } from '@/theme';

interface Props extends TextProps {
  /** 타이포 프리셋 (기본 bodyMedium) */
  preset?: TextPresetKey;
  /** 텍스트 색 (기본 text.primary) */
  color?: string;
}

/**
 * 모든 텍스트의 진입점. 프리셋으로 타이포를 고르고 색만 따로 지정한다.
 *   <AppText preset="cardTitle">제목</AppText>
 *   <AppText preset="caption" color={colors.text.tertiary}>오전 8:12</AppText>
 */
export function AppText({ preset = 'bodyMedium', color = colors.text.primary, style, ...rest }: Props) {
  return <Text {...rest} style={[textPresets[preset], { color }, style]} />;
}
