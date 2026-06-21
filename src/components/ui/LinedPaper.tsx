import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, FeDisplacementMap, FeTurbulence, Filter, Rect } from 'react-native-svg';

import { colors, layout, radius, shadow, spacing } from '@/theme';

// 잘라낸 가장자리가 변위로 잘리지 않도록 시트 밖으로 두는 여유
const DECKLE_PAD = 5;

interface Props {
  children: ReactNode;
  /** 괘선 간격(px, 기본 layout.noteLineGap) */
  lineGap?: number;
  /** 내부 패딩(기본 lg) */
  padding?: number;
  /** 기울임 각도(도) — 잘라 붙인 듯 살짝 비뚤게 */
  tilt?: number;
  /** 잘라낸(찢긴) 가장자리. 기본 true. 필터 미지원 시 일반 종이로 degrade */
  torn?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 라인 노트 종이. 가로 괘선을 깐 종이 표면 — "공책에 손으로 쓴" 일기 메모용.
 * `torn`이면 가장자리를 잘라낸 듯 불규칙하게(같은 종이색 변위 레이어) 만들어 "잘라 붙인" 느낌을 준다.
 * 높이를 측정해 괘선 수를 맞춘다. 색은 토큰 경유.
 */
export function LinedPaper({
  children, lineGap = layout.noteLineGap, padding = spacing.lg, tilt = 0, torn = true, style,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const uid = useId().replace(/:/g, '');
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const count = size.h > 0 ? Math.max(0, Math.floor((size.h - padding) / lineGap)) : 0;
  const dW = size.w + DECKLE_PAD * 2;
  const dH = size.h + DECKLE_PAD * 2;
  return (
    <View style={[styles.wrap, { transform: [{ rotate: `${tilt}deg` }] }, style]}>
      {/* 잘라낸 가장자리: 시트와 같은 종이색을 불규칙 변위로 깔아 직선 모서리를 가린다(같은 색이라 이음새 없음) */}
      {torn && size.w > 0 && (
        <Svg pointerEvents="none" style={styles.deckle} width={dW} height={dH}>
          <Defs>
            <Filter id={uid}>
              <FeTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves={2} seed={4} result="t" />
              <FeDisplacementMap in="SourceGraphic" in2="t" scale={6} xChannelSelector="R" yChannelSelector="G" />
            </Filter>
          </Defs>
          <Rect x={3} y={3} width={dW - 6} height={dH - 6} rx={3} fill={colors.surface.paperRaised} filter={`url(#${uid})`} />
        </Svg>
      )}
      <View style={[styles.sheet, { padding }]} onLayout={onLayout}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={[styles.rule, { top: padding + (i + 1) * lineGap }]} />
          ))}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...shadow.card },
  deckle: { position: 'absolute', top: -DECKLE_PAD, left: -DECKLE_PAD, zIndex: 0 },
  sheet: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.sm,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  rule: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border.rule },
});
