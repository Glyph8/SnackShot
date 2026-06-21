import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, FeDisplacementMap, FeTurbulence, Filter, Line, Rect } from 'react-native-svg';

import { colors } from '@/theme';

interface Props {
  /** 'box'=사각 테두리 · 'underline'=노트 밑줄 한 줄. 기본 'box' */
  shape?: 'box' | 'underline';
  /** 점선 여부. 기본 true(box), underline은 보통 false(실선 밑줄) */
  dashed?: boolean;
  color?: string;
  /** box 모서리 라운드 */
  radius?: number;
  strokeWidth?: number;
  /** 가장자리 안쪽 여백(px) — underline은 좌우 여백으로 쓰임 */
  inset?: number;
  /** 손그림 떨림(ink). 기본 true. 미지원 시 매끈한 선으로 degrade. */
  rough?: boolean;
}

/**
 * 손으로 그은 듯한 테두리/밑줄 — `feDisplacementMap`으로 선이 살짝 흔들린다.
 * 부모를 채우는 absolute 오버레이(터치 통과). 부모는 position:relative여야 한다.
 * 측정 기반 1:1 렌더라 점선 간격·선 두께가 왜곡되지 않는다.
 */
export function HandDrawnBorder({
  shape = 'box', dashed = shape === 'box', color = colors.border.dashed,
  radius = 12, strokeWidth = 1.5, inset = 0, rough = true,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const filter = rough ? `url(#${uid})` : undefined;
  const dash = dashed ? '7 5' : undefined;
  const pad = Math.max(inset, strokeWidth);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          {rough && (
            <Defs>
              <Filter id={uid} x="-5%" y="-30%" width="110%" height="160%">
                <FeTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={9} result="t" />
                <FeDisplacementMap in="SourceGraphic" in2="t" scale={2.4} xChannelSelector="R" yChannelSelector="G" />
              </Filter>
            </Defs>
          )}
          {shape === 'underline' ? (
            <Line
              x1={pad} y1={size.h - strokeWidth * 2} x2={size.w - pad} y2={size.h - strokeWidth * 2}
              stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" filter={filter}
            />
          ) : (
            <Rect
              x={pad} y={pad} width={size.w - pad * 2} height={size.h - pad * 2} rx={radius}
              fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash} filter={filter}
            />
          )}
        </Svg>
      )}
    </View>
  );
}
