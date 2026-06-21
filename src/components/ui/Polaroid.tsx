import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, FeDisplacementMap, FeTurbulence, Filter, Rect } from 'react-native-svg';

import { colors, radius, shadow, spacing } from '@/theme';

import { AppText } from './AppText';

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 데클(찢긴 가장자리) 캔버스가 변위로 잘려나가지 않도록 프레임 밖으로 두는 여유
const DECKLE_PAD = 6;

interface Props {
  /** 미디어 영역(영상/이미지/플레이스홀더) */
  children: ReactNode;
  /** 하단 캡션(손글씨 느낌 권장). footer가 있으면 무시됨 */
  caption?: string;
  /** 미디어 아래 프레임 안에 들어갈 리치 콘텐츠(메타·제목·본문 등). caption보다 우선 */
  footer?: ReactNode;
  /** 길이 — ms(number) 또는 표시 문자열 */
  duration?: number | string;
  /** 좌상단 타입 아이콘 슬롯(영상/음성) */
  typeIcon?: ReactNode;
  /** 미디어 영역 가로:세로 비 (기본 4/3) */
  aspectRatio?: number;
  /** 기울임 각도(도, 기본 0) */
  tilt?: number;
  /** 찢긴 종이 가장자리(deckle). 기본 true. 필터 미지원 시 일반 프레임으로 degrade. */
  deckle?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 폴라로이드 프레임. 미디어를 children으로 받고 길이 캡슐·캡션/푸터를 얹는다. 가장자리는 찢긴 종이(deckle). */
export function Polaroid({
  children, caption, footer, duration, typeIcon, aspectRatio = 4 / 3, tilt = 0, deckle = true, style,
}: Props) {
  const durationLabel = typeof duration === 'number' ? fmtDuration(duration) : duration;
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const uid = useId().replace(/:/g, '');
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== frame.w || height !== frame.h) setFrame({ w: width, h: height });
  };
  const dW = frame.w + DECKLE_PAD * 2;
  const dH = frame.h + DECKLE_PAD * 2;
  return (
    <View
      style={[styles.frame, { transform: [{ rotate: `${tilt}deg` }] }, style]}
      onLayout={deckle ? onLayout : undefined}
    >
      {/* 데클: 프레임과 같은 종이색을 찢긴 가장자리로 덮어 직선 모서리를 가린다(같은 색이라 안쪽 변위도 이음새 없음) */}
      {deckle && frame.w > 0 && (
        <Svg pointerEvents="none" style={styles.deckle} width={dW} height={dH}>
          <Defs>
            <Filter id={uid}>
              <FeTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves={2} seed={6} result="t" />
              <FeDisplacementMap in="SourceGraphic" in2="t" scale={5} xChannelSelector="R" yChannelSelector="G" />
            </Filter>
          </Defs>
          <Rect x={3} y={3} width={dW - 6} height={dH - 6} rx={4} fill={colors.surface.paperRaised} filter={`url(#${uid})`} />
        </Svg>
      )}
      <View style={[styles.media, { aspectRatio }]}>
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
      {footer ? (
        <View style={styles.footer}>{footer}</View>
      ) : caption ? (
        <AppText preset="bodyMedium" color={colors.text.secondary} style={styles.caption} numberOfLines={1}>
          {caption}
        </AppText>
      ) : null}
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
  deckle: { position: 'absolute', top: -DECKLE_PAD, left: -DECKLE_PAD, zIndex: 0 },
  media: {
    borderRadius: radius.sm,
    backgroundColor: colors.media.thumbSlate,
    overflow: 'hidden',
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
  footer: { paddingTop: spacing.md, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
});
