import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, opacity, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'quiet' | 'destructive';
type Size = 'md' | 'sm';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const bg: Record<Variant, string> = {
  primary: colors.brand.primary,
  secondary: colors.surface.paper,
  quiet: 'transparent',
  destructive: 'transparent',
};
const bgPressed: Record<Variant, string> = {
  primary: colors.brand.primaryPressed,
  secondary: colors.surface.sunken,
  quiet: colors.surface.sunken,
  destructive: colors.surface.sunken,
};
const fg: Record<Variant, string> = {
  primary: colors.brand.onPrimary,
  secondary: colors.text.primary,
  quiet: colors.text.secondary,
  destructive: colors.feedback.danger,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
}: Props) {
  const bordered = variant === 'secondary' || variant === 'destructive';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={size === 'sm' ? spacing.sm : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: pressed ? bgPressed[variant] : bg[variant] },
        bordered && styles.bordered,
        variant === 'destructive' && { borderColor: colors.feedback.danger },
        fullWidth && styles.fullWidth,
        disabled && { opacity: opacity.disabled },
        style,
      ]}
    >
      <View style={styles.row}>
        {leftIcon}
        <AppText preset="button" color={fg[variant]}>
          {label}
        </AppText>
        {rightIcon}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTouch,
  },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 0 },
  bordered: { borderWidth: 1, borderColor: colors.border.card },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
