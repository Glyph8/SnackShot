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
  /** 내부 패딩(기본 lg) */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

const FOLD = 16;

/**
 * 포스트잇(스티키 메모). 종이 위에 붙여둔 듯한 색 메모 — 살짝 기울임 + 떠 있는 그림자 +
 * 접힌 모서리. 검토/관리 모드의 결정 카드 표면으로 쓴다. 색은 토큰 경유(`accent.stickySet`).
 */
export function PostIt({ children, color, vary, tilt, peel = true, padding = spacing.lg, style }: Props) {
  const bg = color ?? (vary ? pickVaried(colors.accent.stickySet, `${vary}:sticky-c`) : colors.accent.sticky);
  const rot =
    tilt ?? (vary ? variationValue(`${vary}:sticky-r`) * (layout.stickyTilt * 2) - layout.stickyTilt : 0);
  return (
    <View style={[styles.note, { backgroundColor: bg, padding, transform: [{ rotate: `${rot}deg` }] }, style]}>
      {children}
      {peel && (
        <Svg width={FOLD} height={FOLD} style={styles.fold} pointerEvents="none">
          <Polygon points={`0,${FOLD} ${FOLD},${FOLD} ${FOLD},0`} fill={colors.accent.noteFold} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radius.sm, ...shadow.raised },
  fold: { position: 'absolute', right: 0, bottom: 0 },
});
