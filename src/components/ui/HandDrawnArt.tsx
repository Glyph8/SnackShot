import { useId } from 'react';
import Svg, {
  Circle, Defs, FeDisplacementMap, FeTurbulence, Filter, G, Path, Rect,
} from 'react-native-svg';

import { colors } from '@/theme';
import { pickVaried, variationValue } from '@/lib/variation';

import { tapeShapePath, TAPE_SHAPES } from './Tape';

interface Props {
  /** 정사각 기준 크기(px). 기본 168 */
  size?: number;
  /** 손그림 떨림(ink) 필터. 기본 true. 미지원 시 매끈한 선으로 degrade. */
  rough?: boolean;
  /** 테이프 색·모양·각도를 날마다·실행마다 변주하는 키 */
  vary?: string;
}

/**
 * 빈 상태용 손그림 일러스트 — 마스킹 테이프로 붙인 폴라로이드 + 카메라 스케치.
 * 향후 래스터(수채/과슈) 일러스트로 교체될 자리의 임시 SVG. 색은 전부 토큰 경유.
 */
export function EmptyMomentArt({ size = 168, rough = true, vary = 'empty-moment' }: Props) {
  const uid = useId().replace(/:/g, '');
  const ink = `${uid}-ink`;
  return (
    <Svg width={size} height={(size * 150) / 168} viewBox="0 0 168 150">
      {rough && (
        <Defs>
          <Filter id={ink}>
            <FeTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves={2} seed={11} result="t" />
            <FeDisplacementMap in="SourceGraphic" in2="t" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
          </Filter>
        </Defs>
      )}
      {/* 폴라로이드 + 카메라 라인 스케치 */}
      <G
        filter={rough ? `url(#${ink})` : undefined}
        stroke={colors.text.secondary}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <Rect x="34" y="26" width="104" height="104" rx="4" fill={colors.surface.paperRaised} transform="rotate(-3 86 78)" />
        <Rect x="44" y="38" width="84" height="62" rx="3" fill={colors.surface.sunken} transform="rotate(-3 86 78)" />
        <Circle cx="86" cy="68" r="15" transform="rotate(-3 86 78)" />
        <Circle cx="86" cy="68" r="7" transform="rotate(-3 86 78)" />
        <Path d="M70 110 q16 8 34 0" transform="rotate(-3 86 78)" />
        <Path d="M120 34 l10 -10 M128 28 l4 -2" stroke={colors.brand.primary} />
      </G>
      {/* 마스킹 테이프 2조각 — 색·모양·각도를 날마다·실행마다 변주 */}
      <Path
        d={tapeShapePath(pickVaried(TAPE_SHAPES, `${vary}:s1`), 20, 18, 56, 20)}
        fill={pickVaried(colors.accent.tapeSet, `${vary}:c1`)}
        opacity={0.62}
        transform={`rotate(${-18 + variationValue(`${vary}:a1`) * 12} 48 28)`}
      />
      <Path
        d={tapeShapePath(pickVaried(TAPE_SHAPES, `${vary}:s2`), 96, 116, 52, 18)}
        fill={pickVaried(colors.accent.tapeSet, `${vary}:c2`)}
        opacity={0.55}
        transform={`rotate(${2 + variationValue(`${vary}:a2`) * 12} 122 125)`}
      />
    </Svg>
  );
}

/** 빈 상태용 손그림 — 체크리스트 노트(Inbox: 검토할 결정 없음). */
export function EmptyInboxArt({ size = 168, rough = true, vary = 'empty-inbox' }: Props) {
  const uid = useId().replace(/:/g, '');
  const ink = `${uid}-ink`;
  return (
    <Svg width={size} height={(size * 150) / 168} viewBox="0 0 168 150">
      {rough && (
        <Defs>
          <Filter id={ink}>
            <FeTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves={2} seed={11} result="t" />
            <FeDisplacementMap in="SourceGraphic" in2="t" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
          </Filter>
        </Defs>
      )}
      <G
        filter={rough ? `url(#${ink})` : undefined}
        stroke={colors.text.secondary} strokeWidth={2.4}
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      >
        <G transform="rotate(2 84 78)">
          <Rect x="42" y="30" width="84" height="96" rx="5" fill={colors.surface.paperRaised} />
          <Rect x="52" y="46" width="14" height="14" rx="2" fill={colors.surface.sunken} />
          <Path d="M54 53 l3 4 l6 -8" stroke={colors.brand.primary} />
          <Path d="M74 53 H114 M52 76 H114 M52 96 H100" />
        </G>
      </G>
      <Path
        d={tapeShapePath(pickVaried(TAPE_SHAPES, `${vary}:s`), 56, 18, 56, 18)}
        fill={pickVaried(colors.accent.tapeSet, `${vary}:c`)}
        opacity={0.6}
        transform={`rotate(${-8 + variationValue(`${vary}:a`) * 10} 84 27)`}
      />
    </Svg>
  );
}

/** 빈 상태용 손그림 — 폴라로이드 더미(Archive: 기록 없음). */
export function EmptyArchiveArt({ size = 168, rough = true, vary = 'empty-archive' }: Props) {
  const uid = useId().replace(/:/g, '');
  const ink = `${uid}-ink`;
  return (
    <Svg width={size} height={(size * 150) / 168} viewBox="0 0 168 150">
      {rough && (
        <Defs>
          <Filter id={ink}>
            <FeTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves={2} seed={5} result="t" />
            <FeDisplacementMap in="SourceGraphic" in2="t" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
          </Filter>
        </Defs>
      )}
      <G
        filter={rough ? `url(#${ink})` : undefined}
        stroke={colors.text.secondary} strokeWidth={2.2}
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      >
        <G transform="rotate(-8 84 80)">
          <Rect x="44" y="44" width="76" height="80" rx="4" fill={colors.surface.paperRaised} />
        </G>
        <G transform="rotate(6 84 80)">
          <Rect x="48" y="36" width="76" height="86" rx="4" fill={colors.surface.paperRaised} />
          <Rect x="56" y="44" width="60" height="48" rx="2" fill={colors.surface.sunken} />
          <Path d="M60 88 l14 -16 l9 9 l13 -15 l8 13" />
          <Circle cx="104" cy="54" r="5" />
        </G>
      </G>
      <Path
        d={tapeShapePath(pickVaried(TAPE_SHAPES, `${vary}:s`), 58, 18, 52, 16)}
        fill={pickVaried(colors.accent.tapeSet, `${vary}:c`)}
        opacity={0.58}
        transform={`rotate(${-6 + variationValue(`${vary}:a`) * 10} 84 26)`}
      />
    </Svg>
  );
}
