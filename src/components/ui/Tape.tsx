import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle, ClipPath, Defs, FeDisplacementMap, FeTurbulence, Filter, G, Line, Path,
} from 'react-native-svg';

import { colors, opacity } from '@/theme';
import { pickVaried, variationValue } from '@/lib/variation';

/** 테이프 표면 질감 */
export type TapeTexture = 'plain' | 'washi' | 'striped' | 'grid' | 'dots';
/** 테이프 윤곽(끝 모양) */
export type TapeShape = 'straight' | 'angled' | 'torn' | 'rounded' | 'notched' | 'wave';

/** vary 모드 추첨 후보 */
export const TAPE_TEXTURES: readonly TapeTexture[] = ['plain', 'washi', 'striped', 'grid', 'dots'];
export const TAPE_SHAPES: readonly TapeShape[] = ['straight', 'angled', 'torn', 'rounded', 'notched', 'wave'];

interface Props {
  width?: number;
  height?: number;
  color?: string;
  /** 기울임 각도(도) */
  angle?: number;
  /** 표면 질감. 기본 'washi' */
  texture?: TapeTexture;
  /** 윤곽(끝 모양). 기본 'straight' */
  shape?: TapeShape;
  /**
   * 지정 시 색·질감·모양·찢김을 key 기반으로 **날마다·실행마다 무작위** 선택(고정 prop 무시).
   * angle은 레이아웃용이라 호출부 값을 유지한다.
   */
  vary?: string;
  /**
   * 찢긴 가장자리(feTurbulence+feDisplacementMap). 기본 true.
   * 일부 Android 환경에서 필터가 무시돼도 기본 도형은 정상 렌더된다(graceful degrade).
   */
  rough?: boolean;
  /** 가장자리 난수 시드 — 같은 화면의 여러 테이프를 서로 다르게 찢기 위함 */
  seed?: number;
  /** 위치 지정용 (보통 absolute) */
  style?: StyleProp<ViewStyle>;
}

/**
 * 테이프 윤곽 path 생성기 — (x,y,w,h) 영역의 테이프 모양을 SVG path 'd'로 반환.
 * 끝(좌우 짧은 변)의 형태를 모양별로 다르게 그린다.
 */
export function tapeShapePath(shape: TapeShape, x: number, y: number, w: number, h: number): string {
  const R = x + w;
  const B = y + h;
  const MY = y + h / 2;
  switch (shape) {
    case 'angled': {
      const s = Math.min(h * 0.7, w * 0.25);
      return `M${x + s},${y} L${R},${y} L${R - s},${B} L${x},${B} Z`;
    }
    case 'rounded': {
      const r = h / 2;
      return `M${x + r},${y} L${R - r},${y} A${r},${r} 0 0 1 ${R - r},${B} L${x + r},${B} A${r},${r} 0 0 1 ${x + r},${y} Z`;
    }
    case 'notched': {
      const n = Math.min(h * 0.55, w * 0.16);
      return `M${x},${y} L${R},${y} L${R - n},${MY} L${R},${B} L${x},${B} L${x + n},${MY} Z`;
    }
    case 'wave': {
      const a = Math.min(w * 0.05, 4);
      return `M${x},${y} L${R},${y} Q${R - a},${y + h * 0.25} ${R},${MY} Q${R + a},${y + h * 0.75} ${R},${B} L${x},${B} Q${x + a},${y + h * 0.75} ${x},${MY} Q${x - a},${y + h * 0.25} ${x},${y} Z`;
    }
    case 'torn': {
      const teeth = 4;
      const d = Math.min(w * 0.07, 5);
      let p = `M${x},${y} L${R},${y}`;
      for (let i = 1; i < teeth; i++) p += ` L${i % 2 ? R - d : R},${y + (h * i) / teeth}`;
      p += ` L${R},${B} L${x},${B}`;
      for (let i = teeth - 1; i >= 1; i--) p += ` L${i % 2 ? x + d : x},${y + (h * i) / teeth}`;
      return `${p} Z`;
    }
    default:
      return `M${x},${y} L${R},${y} L${R},${B} L${x},${B} Z`;
  }
}

/** 다양한 색·질감·모양의 테이프 프리셋. 인덱스로 순환하면 손쉽게 변주가 생긴다. */
export const TAPE_VARIANTS: ReadonlyArray<{
  color: string; texture: TapeTexture; shape: TapeShape; angle: number; seed: number;
}> = [
  { color: colors.accent.tapeSet[0], texture: 'washi', shape: 'straight', angle: -7, seed: 7 },
  { color: colors.accent.tapeSet[1], texture: 'striped', shape: 'angled', angle: 5, seed: 3 },
  { color: colors.accent.tapeSet[2], texture: 'dots', shape: 'torn', angle: -4, seed: 11 },
  { color: colors.accent.tapeSet[3], texture: 'grid', shape: 'notched', angle: 8, seed: 5 },
  { color: colors.accent.tapeSet[4], texture: 'plain', shape: 'rounded', angle: -10, seed: 2 },
  { color: colors.accent.tapeSet[0], texture: 'plain', shape: 'wave', angle: 6, seed: 9 },
];

// 표면 질감 오버레이 — 토큰 색만 사용(밝은 결=onMedia, 어두운 선=primary).
function textureOverlay(texture: TapeTexture, x: number, y: number, w: number, h: number) {
  const light = colors.text.onMedia;
  const dark = colors.text.primary;
  switch (texture) {
    case 'washi': {
      const n = 5;
      return Array.from({ length: n }, (_, i) => {
        const lx = x + ((i + 0.5) * w) / n;
        return <Line key={i} x1={lx} y1={y + 1} x2={lx} y2={y + h - 1} stroke={light} strokeOpacity={0.2} strokeWidth={1} />;
      });
    }
    case 'striped': {
      const n = 5;
      const step = (w + h) / n;
      return Array.from({ length: n }, (_, i) => {
        const off = -h + i * step;
        return <Line key={i} x1={x + off} y1={y + h} x2={x + off + h} y2={y} stroke={light} strokeOpacity={0.28} strokeWidth={2.5} />;
      });
    }
    case 'grid': {
      const v = [0.25, 0.5, 0.75].map((f, i) => (
        <Line key={`v${i}`} x1={x + w * f} y1={y + 1} x2={x + w * f} y2={y + h - 1} stroke={dark} strokeOpacity={0.14} strokeWidth={1} />
      ));
      const hLn = [0.4, 0.7].map((f, i) => (
        <Line key={`h${i}`} x1={x + 1} y1={y + h * f} x2={x + w - 1} y2={y + h * f} stroke={dark} strokeOpacity={0.14} strokeWidth={1} />
      ));
      return [...v, ...hLn];
    }
    case 'dots': {
      const cols = 6;
      const rows = 2;
      const dots = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push(
            <Circle key={`${r}-${c}`} cx={x + ((c + 0.5) * w) / cols} cy={y + ((r + 0.5) * h) / rows} r={1.3} fill={light} fillOpacity={0.32} />,
          );
        }
      }
      return dots;
    }
    default:
      return null;
  }
}

/** 마스킹 테이프 장식. 반투명 + 손으로 자른 가장자리 + 다양한 색·질감·모양. */
export function Tape({
  width = 64, height = 22, color = colors.accent.tape,
  angle = -4, texture = 'washi', shape = 'straight', vary, rough = true, seed = 7, style,
}: Props) {
  // vary 키가 있으면 색·질감·모양·찢김을 그날/그 실행에 고정된 값으로 추첨
  const vColor = vary ? pickVaried(colors.accent.tapeSet, `${vary}:tape-c`) : color;
  const vTexture = vary ? pickVaried(TAPE_TEXTURES, `${vary}:tape-tx`) : texture;
  const vShape = vary ? pickVaried(TAPE_SHAPES, `${vary}:tape-sh`) : shape;
  const vSeed = vary ? 1 + Math.floor(variationValue(`${vary}:tape-sd`) * 200) : seed;
  // 변위가 가장자리를 캔버스 밖으로 밀지 않도록 여유 패딩
  const pad = 6;
  const w = width + pad * 2;
  const h = height + pad * 2;
  const uid = useId().replace(/:/g, '');
  const clip = `${uid}-clip`;
  const path = tapeShapePath(vShape, pad, pad, width, height);
  return (
    <View style={[{ width, height, transform: [{ rotate: `${angle}deg` }] }, style]}>
      <Svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ marginLeft: -pad, marginTop: -pad, opacity: opacity.muted }}
      >
        <Defs>
          {rough && (
            <Filter id={uid}>
              <FeTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves={2} seed={vSeed} result="t" />
              <FeDisplacementMap in="SourceGraphic" in2="t" scale={6} xChannelSelector="R" yChannelSelector="G" />
            </Filter>
          )}
          <ClipPath id={clip}>
            <Path d={path} />
          </ClipPath>
        </Defs>
        <G filter={rough ? `url(#${uid})` : undefined}>
          <Path d={path} fill={vColor} />
          <G clipPath={`url(#${clip})`}>{textureOverlay(vTexture, pad, pad, width, height)}</G>
        </G>
      </Svg>
    </View>
  );
}
