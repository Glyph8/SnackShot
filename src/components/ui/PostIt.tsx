import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { colors, layout, radius, shadow, spacing } from '@/theme';
import { pickVaried, variationValue } from '@/lib/variation';

interface Props {
  children: ReactNode;
  /** 메모 색(미지정 시 vary 또는 기본 노랑) */
  color?: string;
  /** 지정 시 색·기울임을 key 기반으로 날마다·실행마다 변주(렌더 중엔 고정) */
  vary?: string;
  /** 명시 기울임(도). 지정 시 vary 기울임 대신 사용 */
  tilt?: number;
  /** 접힌 모서리(dog-ear). 기본 true */
  peel?: boolean;
  /** 아래가 살짝 들뜬 효과(바닥 모서리가 떠 있는 곡면 그림자). 기본 false */
  lift?: boolean;
  /** 여러 번 접힌 자국(가로 주름선). 완료/보관된 메모에. 기본 false */
  creased?: boolean;
  /** 내부 패딩(기본 lg) */
  padding?: number;
  /** 메모 표면(내용 레이아웃·gap 등) 스타일 */
  style?: StyleProp<ViewStyle>;
  /** 바깥 컨테이너(여백·정렬 등) 스타일 */
  containerStyle?: StyleProp<ViewStyle>;
}

const FOLD = 16;

/**
 * 포스트잇(스티키 메모). 색 메모 + 살짝 기울임 + 떠 있는 그림자 + 접힌 모서리.
 * `lift`를 주면 **아래가 살짝 들뜬** 곡면 그림자를 더해 바닥 모서리가 떠 있게 보인다.
 * 의사결정/검토 카드 표면으로 쓴다. 색은 토큰 경유(`accent.stickySet`).
 */
const CREASE_TOPS = ['28%', '50%', '72%'] as const;

export function PostIt({
  children, color, vary, tilt, peel = true, lift = false, creased = false, padding = spacing.lg, style, containerStyle,
}: Props) {
  const bg = color ?? (vary ? pickVaried(colors.accent.stickySet, `${vary}:sticky-c`) : colors.accent.sticky);
  const rot =
    tilt ?? (vary ? variationValue(`${vary}:sticky-r`) * (layout.stickyTilt * 2) - layout.stickyTilt : 0);
  return (
    <View style={[{ transform: [{ rotate: `${rot}deg` }] }, containerStyle]}>
      {/* 바닥 들뜸 — 메모 뒤에 깔린 어두운 곡면이 양 바닥 모서리에서 그림자로 새어나온다(메모가 덮어 occlude). */}
      {lift && (
        <>
          <View style={[styles.lift, styles.liftLeft]} pointerEvents="none" />
          <View style={[styles.lift, styles.liftRight]} pointerEvents="none" />
        </>
      )}
      <View style={[styles.note, { backgroundColor: bg, padding }, style]}>
        {children}
        {/* 여러 번 접힌 자국 — 가로 주름선(음영 + 아래쪽 하이라이트) */}
        {creased && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {CREASE_TOPS.map((top) => (
              <View key={top} style={[styles.crease, { top }]}>
                <View style={styles.creaseShade} />
                <View style={styles.creaseLight} />
              </View>
            ))}
          </View>
        )}
        {peel && (
          <Svg width={FOLD} height={FOLD} style={styles.fold} pointerEvents="none">
            <Polygon points={`0,${FOLD} ${FOLD},${FOLD} ${FOLD},0`} fill={colors.accent.noteFold} />
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radius.sm, ...shadow.raised },
  fold: { position: 'absolute', right: 0, bottom: 0 },
  crease: { position: 'absolute', left: 0, right: 0 },
  creaseShade: { height: StyleSheet.hairlineWidth, backgroundColor: colors.accent.noteFold },
  creaseLight: { height: StyleSheet.hairlineWidth, backgroundColor: colors.text.onMediaMuted },
  lift: {
    position: 'absolute',
    bottom: spacing.sm,
    height: 16,
    borderRadius: radius.xs,
    backgroundColor: colors.text.primary,
    ...shadow.raised,
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  liftLeft: { left: '6%', width: '44%', transform: [{ rotate: '-2.5deg' }] },
  liftRight: { right: '6%', width: '44%', transform: [{ rotate: '2.5deg' }] },
});
