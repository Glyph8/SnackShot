/**
 * SnackShot 테마 배럴.
 *
 * 사용:
 *   import { theme } from '@/theme';
 *   backgroundColor: theme.colors.surface.paper
 *   ...theme.text.cardTitle
 *
 * 개별 토큰도 직접 import 가능:
 *   import { colors, spacing } from '@/theme';
 */

import {
  borderWidth,
  colors,
  duration,
  easing,
  iconSize,
  layout,
  opacity,
  radius,
  shadow,
  spacing,
} from './tokens';
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  textPresets,
} from './typography';

export const theme = {
  colors,
  spacing,
  radius,
  borderWidth,
  shadow,
  opacity,
  duration,
  easing,
  iconSize,
  layout,
  font: { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing },
  text: textPresets,
} as const;

export type Theme = typeof theme;

// 개별 토큰 재export
export * from './tokens';
export * from './typography';
