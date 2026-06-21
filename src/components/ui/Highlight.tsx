import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, FeDisplacementMap, FeTurbulence, Filter, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';
import { pickVaried } from '@/lib/variation';

/** 형광펜 모양 */
export type HighlightShape = 'marker' | 'underline' | 'rounded' | 'scribble' | 'double' | 'circle' | 'strike';
/** 형광펜 두께 */
export type HighlightThickness = 'sm' | 'md' | 'lg';

// vary 모드에서 무작위로 뽑는 후보(헤더용 — strike는 취소선처럼 보여 제외)
const VARY_SHAPES: readonly HighlightShape[] = ['marker', 'underline', 'rounded', 'double', 'circle', 'scribble'];
const VARY_THICK: readonly HighlightThickness[] = ['sm', 'md', 'lg'];

interface Props {
  /** 강조할 텍스트(보통 AppText) */
  children: ReactNode;
  color?: string;
  /** 모양. 기본 'marker' */
  shape?: HighlightShape;
  /** 두께. 기본 'md' */
  thickness?: HighlightThickness;
  /**
   * 지정 시 색·모양·두께를 이 key 기반으로 **날마다·실행마다 무작위** 선택(고정 prop 무시).
   * 같은 날·같은 실행에선 고정되어 리렌더/탭이동에도 안 바뀐다(깜빡임 없음).
   */
  vary?: string;
  /** 거친 마커 가장자리. 기본 true. 필터 미지원 시 매끈한 모양으로 degrade. */
  rough?: boolean;
  style?: StyleProp<ViewStyle>;
}

// 밴드형(marker/rounded) 높이 비율 · 선형(underline/circle/scribble) 두께(px)
const BAND_FRAC: Record<HighlightThickness, number> = { sm: 0.34, md: 0.55, lg: 0.82 };
const STROKE_PX: Record<HighlightThickness, number> = { sm: 3, md: 5.5, lg: 9 };

function renderShape(
  shape: HighlightShape, color: string, thickness: HighlightThickness,
  w: number, h: number, filter: string | undefined,
): ReactNode {
  const sw = STROKE_PX[thickness];
  switch (shape) {
    case 'underline': {
      const t = Math.max(3, sw);
      return <Rect x={0} y={h - t - 1} width={w} height={t} rx={t / 2} fill={color} opacity={0.85} filter={filter} />;
    }
    case 'double': {
      const t = Math.max(2, sw * 0.5);
      return (
        <>
          <Rect x={0} y={h - t - 1} width={w} height={t} fill={color} opacity={0.85} filter={filter} />
          <Rect x={0} y={h - t * 3 - 2} width={w} height={t} fill={color} opacity={0.85} filter={filter} />
        </>
      );
    }
    case 'strike': {
      const t = Math.max(3, sw);
      return <Rect x={0} y={h / 2 - t / 2} width={w} height={t} rx={t / 2} fill={color} opacity={0.85} filter={filter} />;
    }
    case 'rounded': {
      const bh = h * BAND_FRAC[thickness];
      return <Rect x={-2} y={h - bh - h * 0.05} width={w + 4} height={bh} rx={bh / 2} fill={color} opacity={0.8} filter={filter} />;
    }
    case 'circle': {
      return (
        <Ellipse
          cx={w / 2} cy={h / 2} rx={w / 2 - sw} ry={h / 2 - sw * 0.4}
          fill="none" stroke={color} strokeWidth={Math.max(2, sw * 0.6)} opacity={0.85} filter={filter}
        />
      );
    }
    case 'scribble': {
      const yb = h * 0.66;
      const amp = h * 0.16;
      const seg = 7;
      const dx = (w - 4) / seg;
      let d = `M2,${yb}`;
      for (let i = 1; i <= seg; i++) {
        const x = 2 + dx * i;
        const cy = yb + (i % 2 ? -amp : amp);
        d += ` Q${x - dx / 2},${cy} ${x},${yb}`;
      }
      return <Path d={d} fill="none" stroke={color} strokeWidth={Math.max(3, sw * 0.8)} strokeLinecap="round" opacity={0.8} filter={filter} />;
    }
    default: { // marker
      const bh = h * BAND_FRAC[thickness];
      return <Rect x={-1} y={h - bh - h * 0.05} width={w + 2} height={bh} rx={1.5} fill={color} opacity={0.82} filter={filter} />;
    }
  }
}

/** 형광펜 강조 — 텍스트 뒤에 손으로 그은 마커. 색·두께·모양 변주 가능. */
export function Highlight({
  children, color = colors.accent.highlight, shape = 'marker', thickness = 'md', vary, rough = true, style,
}: Props) {
  // vary 키가 있으면 색·모양·두께를 그날/그 실행에 고정된 값으로 무작위 선택
  const pickedColor = vary ? pickVaried(colors.accent.highlightSet, `${vary}:c`) : color;
  const pickedShape = vary ? pickVaried(VARY_SHAPES, `${vary}:s`) : shape;
  const pickedThickness = vary ? pickVaried(VARY_THICK, `${vary}:t`) : thickness;
  const uid = useId().replace(/:/g, '');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const filter = rough ? `url(#${uid})` : undefined;
  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {size.w > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
          {rough && (
            <Defs>
              <Filter id={uid} x="-12%" y="-30%" width="124%" height="170%">
                <FeTurbulence type="fractalNoise" baseFrequency="0.9 0.4" numOctaves={2} seed={4} result="t" />
                <FeDisplacementMap in="SourceGraphic" in2="t" scale={2.5} xChannelSelector="R" yChannelSelector="G" />
              </Filter>
            </Defs>
          )}
          {renderShape(pickedShape, pickedColor, pickedThickness, size.w, size.h, filter)}
        </Svg>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', position: 'relative' },
});
