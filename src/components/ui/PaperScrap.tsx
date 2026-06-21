import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, shadow, spacing } from '@/theme';

const TEETH_H = 6; // 밑단 천공 톱니 높이

function zigzagPath(w: number): string {
  const n = Math.max(6, Math.round(w / 10));
  const s = w / n;
  let d = `M0 ${TEETH_H}`;
  for (let i = 0; i < n; i += 1) d += ` L${(i + 0.5) * s} 0 L${(i + 1) * s} ${TEETH_H}`;
  return `${d} Z`;
}

interface Props {
  children: ReactNode;
  /** 상단 색 스탬프 띠(지표 색 등) */
  accent?: string;
  /** 내부 패딩(기본 md) */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 종이 조각(영수증 스크랩) — `surface.paperRaised` 종이 + 밑단 천공(zigzag) + `card` 그림자.
 * 상단에 `accent` 색 띠를 둘 수 있다(영수증 머리). 작은 지표 타일 등에 쓴다. 색은 토큰 경유.
 */
export function PaperScrap({ children, accent, padding = spacing.md, style }: Props) {
  const [width, setWidth] = useState(0);
  const uid = useId().replace(/:/g, '');
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - width) > 0.5) setWidth(w);
  };
  return (
    <View
      style={[
        styles.scrap,
        { paddingTop: padding + (accent ? spacing.xs : 0), paddingHorizontal: padding, paddingBottom: padding + TEETH_H },
        style,
      ]}
      onLayout={onLayout}
    >
      {accent && <View style={[styles.tab, { backgroundColor: accent }]} />}
      {children}
      {width > 0 && (
        <Svg key={uid} width={width} height={TEETH_H} style={styles.teeth} pointerEvents="none">
          <Path d={zigzagPath(width)} fill={colors.background.canvas} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrap: {
    backgroundColor: colors.surface.paperRaised,
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.xs,
    ...shadow.card,
  },
  tab: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs },
  teeth: { position: 'absolute', left: 0, bottom: 0 },
});
