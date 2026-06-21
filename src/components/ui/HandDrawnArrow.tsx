import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, FeDisplacementMap, FeTurbulence, Filter, Path } from 'react-native-svg';

import { colors } from '@/theme';

interface Props {
  /** 향하는 방향 */
  direction: 'left' | 'right';
  /** 글리프 한 변 크기(px, 기본 24) */
  size?: number;
  color?: string;
  /** 손그림 떨림(ink). 기본 true. 미지원 시 매끈한 선으로 degrade */
  rough?: boolean;
  style?: StyleProp<ViewStyle>;
}

// 오른쪽 화살표(viewBox 0 0 24 24): 살짝 휜 샤프트 + 두 갈래 화살촉 — 펜으로 그은 느낌
const RIGHT = 'M4 12.6 C9 11.8, 14 12.4, 19 12 M19 12 L13.4 7.4 M19 12 L13 16.8';
const LEFT = 'M20 12.6 C15 11.8, 10 12.4, 5 12 M5 12 L10.6 7.4 M5 12 L11 16.8';

/**
 * 손으로 쓴 듯한 화살표(‹ ›). 샤프트+화살촉을 `feDisplacementMap`으로 살짝 흔들어 펜선처럼.
 * 동그란 버튼 대신 페이지 넘김·날짜 이동에 쓴다. 색은 토큰 경유.
 */
export function HandDrawnArrow({ direction, size = 24, color = colors.text.secondary, rough = true, style }: Props) {
  const uid = useId().replace(/:/g, '');
  const filter = rough ? `url(#${uid})` : undefined;
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {rough && (
          <Defs>
            <Filter id={uid} x="-15%" y="-15%" width="130%" height="130%">
              <FeTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={7} result="t" />
              <FeDisplacementMap in="SourceGraphic" in2="t" scale={1.6} xChannelSelector="R" yChannelSelector="G" />
            </Filter>
          </Defs>
        )}
        <Path
          d={direction === 'right' ? RIGHT : LEFT}
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={filter}
        />
      </Svg>
    </View>
  );
}
