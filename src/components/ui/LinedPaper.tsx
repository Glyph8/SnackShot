import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radius, shadow, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  /** 좌측 빨강 마진 세로선(기본 false) */
  margin?: boolean;
  /** 괘선 간격(px, 기본 layout.noteLineGap) */
  lineGap?: number;
  /** 내부 패딩(기본 lg) */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 라인 노트 종이. 가로 괘선(+선택 좌측 마진)을 깐 종이 표면 — "노트에 손으로 쓴" 일기 메모용.
 * 높이를 측정해 괘선 수를 맞춘다(필터/SVG 불필요, 가벼운 View 타일). 색은 토큰 경유.
 */
export function LinedPaper({ children, margin = false, lineGap = layout.noteLineGap, padding = spacing.lg, style }: Props) {
  const [height, setHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (Math.abs(next - height) > 0.5) setHeight(next);
  };
  const count = height > 0 ? Math.max(0, Math.floor((height - padding) / lineGap)) : 0;
  return (
    <View style={[styles.sheet, { padding }, style]} onLayout={onLayout}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={[styles.rule, { top: padding + (i + 1) * lineGap }]} />
        ))}
        {margin && <View style={styles.margin} />}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    overflow: 'hidden',
    ...shadow.card,
  },
  rule: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.rule },
  margin: { position: 'absolute', top: 0, bottom: 0, left: spacing['3xl'], width: StyleSheet.hairlineWidth, backgroundColor: colors.accent.noteMargin },
});
