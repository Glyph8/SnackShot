import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, FeColorMatrix, FeTurbulence, Filter, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

interface Props {
  /** 섬유 결 + 얼룩진 종이 톤. 기본 true */
  grain?: boolean;
  /** 가장자리 비네팅(페이지 깊이). 기본 true */
  vignette?: boolean;
}

// feColorMatrix: 노이즈 R채널을 알파로 → 일정 색의 얼룩/결. (a = alpha * R_in)
const brown = (alpha: number) =>
  `0 0 0 0 0.24  0 0 0 0 0.19  0 0 0 0 0.12  ${alpha} 0 0 0 0`;

/**
 * 종이 질감 오버레이 — 실제 노트처럼: 저주파 얼룩(종이 톤 불균일) + 고주파 섬유 결 + 가장자리 비네팅.
 * 정적이라 1회만 렌더되고, 콘텐츠 뒤에서 터치를 통과시킨다(`ScreenBackground` 내부 사용).
 * 색은 토큰 경유. 필터 미지원 환경에선 결이 빠지고 캔버스/도트만 남는다(graceful degrade).
 */
export function PaperTexture({ grain = true, vignette = true }: Props) {
  const uid = useId().replace(/:/g, '');
  const mottleId = `${uid}-mottle`;
  const grainId = `${uid}-grain`;
  const vigId = `${uid}-vig`;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        {grain && (
          <>
            {/* 저주파 얼룩 — 종이 톤이 균일하지 않게(빛바랜 패치) */}
            <Filter id={mottleId} x="0" y="0" width="100%" height="100%">
              <FeTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves={3} seed={21} stitchTiles="stitch" result="n" />
              <FeColorMatrix in="n" type="matrix" values={brown(0.13)} />
            </Filter>
            {/* 고주파 섬유 결 */}
            <Filter id={grainId} x="0" y="0" width="100%" height="100%">
              <FeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" result="n" />
              <FeColorMatrix in="n" type="matrix" values={brown(0.16)} />
            </Filter>
          </>
        )}
        {vignette && (
          <RadialGradient id={vigId} cx="50%" cy="40%" r="80%">
            <Stop offset="0.55" stopColor={colors.text.primary} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.text.primary} stopOpacity={0.16} />
          </RadialGradient>
        )}
      </Defs>
      {grain && <Rect x="0" y="0" width="100%" height="100%" filter={`url(#${mottleId})`} />}
      {grain && <Rect x="0" y="0" width="100%" height="100%" filter={`url(#${grainId})`} />}
      {vignette && <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${vigId})`} />}
    </Svg>
  );
}
