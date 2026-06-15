import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';

import { AppText } from './AppText';

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  /** 미디어 영역(영상/이미지/플레이스홀더) */
  children: ReactNode;
  /** 하단 캡션(손글씨 느낌 권장) */
  caption?: string;
  /** 길이 — ms(number) 또는 표시 문자열 */
  duration?: number | string;
  /** 좌상단 타입 아이콘 슬롯(영상/음성) */
  typeIcon?: ReactNode;
  /** 기울임 각도(도, 기본 0) */
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}

/** 폴라로이드 프레임. 미디어를 children으로 받고 길이 캡슐·캡션을 얹는다. */
export function Polaroid({ children, caption, duration, typeIcon, tilt = 0, style }: Props) {
  const durationLabel = typeof duration === 'number' ? fmtDuration(duration) : duration;
  return (
    <View style={[styles.frame, { transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <View style={styles.media}>
        {children}
        {typeIcon && <View style={styles.typeIcon}>{typeIcon}</View>}
        {durationLabel && (
          <View style={styles.durationPill}>
            <AppText preset="caption" color={colors.text.onMedia}>
              {durationLabel}
            </AppText>
          </View>
        )}
      </View>
      {caption && (
        <AppText preset="bodyMedium" color={colors.text.secondary} style={styles.caption} numberOfLines={1}>
          {caption}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    ...shadow.raised,
  },
  media: {
    borderRadius: radius.sm,
    backgroundColor: colors.media.thumbSlate,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
  },
  typeIcon: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  durationPill: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.media.durationPillBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  caption: { textAlign: 'center', marginTop: spacing.sm },
});
