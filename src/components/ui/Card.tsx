import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  /** 떠 있는 카드(밝은 표면 + 강한 그림자) */
  raised?: boolean;
  /** 내부 패딩 (기본 lg) */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/** 종이 카드. 일반(paper)·떠 있는(paperRaised) 두 단계. */
export function Card({ children, raised = false, padding = spacing.lg, style }: Props) {
  return (
    <View
      style={[
        styles.base,
        raised ? styles.raised : styles.flat,
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.card,
  },
  flat: { backgroundColor: colors.surface.paper, ...shadow.card },
  raised: { backgroundColor: colors.surface.paperRaised, ...shadow.raised },
});
