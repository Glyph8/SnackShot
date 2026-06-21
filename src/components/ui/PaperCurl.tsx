import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme';

interface Props {
  /** 말려 올라가는 모서리 위치(종이 바닥 좌/우) */
  side: 'left' | 'right';
  /** 한 변 크기(px, 기본 36) */
  size?: number;
  /** 종이 앞면 색 — 말린 밑면은 이 색의 음영/하이라이트로 표현 */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// viewBox 0 0 100 100, 바깥 모서리는 바닥(왼쪽=좌하단·오른쪽=우하단)
const SHAPES = {
  right: {
    flap: 'M44 100 Q80 92 100 44 L100 100 Z',
    shadow: 'M38 100 Q82 90 100 38 L100 100 Z',
    crease: 'M44 100 Q80 92 100 44',
    grad: { x1: '0', y1: '0', x2: '1', y2: '1' },
  },
  left: {
    flap: 'M0 44 Q20 92 56 100 L0 100 Z',
    shadow: 'M0 38 Q18 90 62 100 L0 100 Z',
    crease: 'M0 44 Q20 92 56 100',
    grad: { x1: '1', y1: '0', x2: '0', y2: '1' },
  },
} as const;

/**
 * 종이 말림(page curl) — 바닥 모서리가 배경에서 살짝 말려 올라간 디테일.
 * 말린 밑면(그라데이션: 빛 받는 입술 → 종이색) + 접힘 크리스 선 + 배경에 드리운 그림자.
 * "배경 위에 붙은 종이" 느낌. 보통 카드 바닥 모서리에 absolute로 얹는다. 색은 토큰 경유.
 */
export function PaperCurl({ side, size = 36, color = colors.surface.paperRaised, style }: Props) {
  const uid = useId().replace(/:/g, '');
  const g = `${uid}-g`;
  const s = SHAPES[side];
  return (
    <View style={style} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={g} x1={s.grad.x1} y1={s.grad.y1} x2={s.grad.x2} y2={s.grad.y2}>
            <Stop offset="0" stopColor={colors.text.onMedia} stopOpacity={0.55} />
            <Stop offset="0.4" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        {/* 배경에 드리운 컬 그림자 */}
        <Path d={s.shadow} fill={colors.text.primary} opacity={0.16} />
        {/* 말린 밑면 */}
        <Path d={s.flap} fill={`url(#${g})`} />
        {/* 접힘 크리스 */}
        <Path d={s.crease} stroke={colors.text.primary} strokeOpacity={0.16} strokeWidth={1.2} fill="none" />
      </Svg>
    </View>
  );
}
