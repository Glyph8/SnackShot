import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors, shadow } from '@/theme';
import { pickVaried, variationValue } from '@/lib/variation';

interface Props {
  /** 머리 지름 (기본 22). 바늘 포함 전체 높이는 ≈ size×1.67 */
  size?: number;
  color?: string;
  /** 지정 시 색·꽂힌 각도를 key 기반으로 날마다·실행마다 변주(각도는 ±22°, 항상 아래로) */
  vary?: string;
  /** 위치 지정용 (보통 absolute) */
  style?: StyleProp<ViewStyle>;
}

/**
 * 압정(푸시핀) — 광택 있는 둥근 머리 + 길고 또렷한 금속 바늘. "꽂아둔 기록" 은유.
 * `vary` 시 머리 색은 `accent.pinSet`에서, 꽂힌 각도는 ±22°(위→아래 유지) 무작위.
 * 색은 토큰 경유. 보통 카드 위 absolute 배치.
 */
export function Pin({ size = 22, color, vary, style }: Props) {
  const uid = useId().replace(/:/g, '');
  const hi = `${uid}-hi`;
  const sh = `${uid}-sh`;
  const ndl = `${uid}-ndl`;
  const headColor = color ?? (vary ? pickVaried(colors.accent.pinSet, `${vary}:pin-c`) : colors.accent.pin);
  const rot = vary ? variationValue(`${vary}:pin-r`) * 44 - 22 : 0;
  const w = size;
  const h = size * (40 / 24);
  return (
    <View style={[styles.base, { width: w, height: h, transform: [{ rotate: `${rot}deg` }] }, style]}>
      <Svg width={w} height={h} viewBox="0 0 24 40">
        <Defs>
          <RadialGradient id={hi} cx="34%" cy="26%" r="72%">
            <Stop offset="0" stopColor={colors.text.onMedia} stopOpacity={0.9} />
            <Stop offset="0.5" stopColor={colors.text.onMedia} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={sh} cx="68%" cy="72%" r="68%">
            <Stop offset="0" stopColor={colors.text.primary} stopOpacity={0.4} />
            <Stop offset="0.78" stopColor={colors.text.primary} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={ndl} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.text.secondary} />
            <Stop offset="0.45" stopColor={colors.text.tertiary} />
            <Stop offset="1" stopColor={colors.text.secondary} />
          </LinearGradient>
        </Defs>

        {/* 금속 바늘 — 머리 아래로 길게 */}
        <Path d="M9.4 20 L14.6 20 L12 39 Z" fill={`url(#${ndl})`} />
        <Path d="M12 21 L12 38" stroke={colors.text.onMedia} strokeOpacity={0.45} strokeWidth={0.7} />

        {/* 머리: 베이스 → 음영 → 광택 */}
        <Circle cx="12" cy="12" r="11" fill={headColor} />
        <Circle cx="12" cy="12" r="11" fill={`url(#${sh})`} />
        <Circle cx="12" cy="12" r="11" fill={`url(#${hi})`} />
        {/* 림(가장자리 정의) */}
        <Circle cx="12" cy="12" r="10.5" fill="none" stroke={colors.text.primary} strokeOpacity={0.12} strokeWidth={0.9} />
        {/* 스펙큘러 광택 점 */}
        <Ellipse cx="8.3" cy="8" rx="3" ry="2" fill={colors.text.onMedia} opacity={0.92} transform="rotate(-30 8.3 8)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', ...shadow.pin },
});
