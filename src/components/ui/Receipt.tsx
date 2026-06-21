import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, radius, shadow, spacing } from '@/theme';

import { Tape } from './Tape';

const ROLL_H = 24; // 상단 종이 롤(코일) 높이
const TUCK = 8; // 영수증이 롤 밑으로 말려 들어간 정도
const TEETH_H = 7; // 천공(뜯은) 밑단 톱니 높이

// 영수증 밑단 천공(zigzag) — 배경색 톱니가 종이 밑단을 지그재그로 뜯어낸 모양
function zigzagPath(w: number): string {
  const n = Math.max(8, Math.round(w / 13));
  const s = w / n;
  let d = `M0 ${TEETH_H}`;
  for (let i = 0; i < n; i += 1) d += ` L${(i + 0.5) * s} 0 L${(i + 1) * s} ${TEETH_H}`;
  return `${d} Z`;
}

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * 영수증 — 상단에 둥글게 말린 종이 롤(코일)에서 풀려 나온 용지. 테이프로 붙여둔 모습.
 * 용지는 `surface.paperRaised`, 내용은 검정 잉크로 인쇄한 느낌(호출부가 `text.primary` 사용).
 * 밑단은 천공(zigzag)으로 뜯어낸 가장자리. 폭을 측정해 롤·천공을 1:1로 그린다. 색은 토큰 경유.
 */
export function Receipt({ children, style }: Props) {
  const [width, setWidth] = useState(0);
  const uid = useId().replace(/:/g, '');
  const cyl = `${uid}-c`;
  const cap = ROLL_H / 2;
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - width) > 0.5) setWidth(w);
  };

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {/* 용지(인쇄 내용) — 롤 밑으로 말려 들어가도록 위를 가린다 */}
      <View style={styles.sheet}>
        {children}
        {width > 0 && (
          <Svg width={width} height={TEETH_H} style={styles.teeth} pointerEvents="none">
            <Path d={zigzagPath(width)} fill={colors.background.canvas} />
          </Svg>
        )}
      </View>

      {/* 둥글게 말린 종이 롤(코일) */}
      {width > 0 && (
        <View style={styles.roll} pointerEvents="none">
          <Svg width={width} height={ROLL_H}>
            <Defs>
              <LinearGradient id={cyl} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.text.onMedia} stopOpacity={0.6} />
                <Stop offset="0.45" stopColor={colors.surface.paperRaised} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.text.primary} stopOpacity={0.22} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={ROLL_H} rx={cap} fill={`url(#${cyl})`} />
            {/* 용지가 풀려 나오는 이음새 */}
            <Path d={`M${cap} ${ROLL_H - 3} H${width - cap}`} stroke={colors.accent.noteFold} strokeWidth={1} />
            {/* 양 끝 코일 링(말린 단면) */}
            <Circle cx={cap} cy={cap} r={cap - 4} stroke={colors.accent.noteFold} strokeWidth={1} fill="none" />
            <Circle cx={cap} cy={cap} r={cap - 8} stroke={colors.accent.noteFold} strokeWidth={1} fill="none" />
            <Circle cx={width - cap} cy={cap} r={cap - 4} stroke={colors.accent.noteFold} strokeWidth={1} fill="none" />
            <Circle cx={width - cap} cy={cap} r={cap - 8} stroke={colors.accent.noteFold} strokeWidth={1} fill="none" />
          </Svg>
        </View>
      )}

      {/* 테이프로 붙여둔 모습 */}
      <View style={styles.tapeLeft} pointerEvents="none"><Tape width={54} height={18} angle={-20} vary={`${uid}-tl`} /></View>
      <View style={styles.tapeRight} pointerEvents="none"><Tape width={54} height={18} angle={20} vary={`${uid}-tr`} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  sheet: {
    marginTop: ROLL_H - TUCK,
    backgroundColor: colors.surface.paperRaised,
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.xs,
    ...shadow.card,
  },
  teeth: { position: 'absolute', left: 0, bottom: 0 },
  roll: { position: 'absolute', top: 0, left: 0, right: 0, height: ROLL_H, ...shadow.card },
  tapeLeft: { position: 'absolute', top: -6, left: spacing.xl, zIndex: 3 },
  tapeRight: { position: 'absolute', top: -6, right: spacing.xl, zIndex: 3 },
});
