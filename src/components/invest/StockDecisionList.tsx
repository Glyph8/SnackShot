import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, Tag } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';

// I3(c)2: 결정이 있는 종목 리스트. 그룹핑은 호출자(invest 화면)에서 — 여기선 렌더만.

export interface StockDecisionRow {
  /** 라우팅 키(ticker 우선, 없으면 종목명) */
  key: string;
  name: string;
  ticker?: string;
  count: number;
  deliberatingCount: number;
}

export function StockDecisionList({
  rows, onPress,
}: {
  rows: StockDecisionRow[];
  onPress(key: string): void;
}) {
  if (rows.length === 0) {
    return (
      <AppText preset="bodySmall" color={colors.text.tertiary}>
        아직 매매 결정이 없어요. 결정을 작성할 때 투자 카테고리로 남기면 여기 모입니다.
      </AppText>
    );
  }
  return (
    <View style={styles.wrap}>
      {rows.map((r) => (
        <Pressable key={r.key} style={styles.row} onPress={() => onPress(r.key)}>
          <View style={styles.left}>
            <AppText preset="bodyMedium" numberOfLines={1}>{r.name}</AppText>
            {r.ticker && <Tag label={r.ticker} bg={colors.surface.sunken} color={colors.text.secondary} />}
          </View>
          <View style={styles.right}>
            <AppText preset="caption" color={colors.text.secondary}>
              {`결정 ${r.count}${r.deliberatingCount > 0 ? ` · 미결 ${r.deliberatingCount}` : ''}`}
            </AppText>
            <Icon name="forward" size={iconSize.md} color={colors.text.tertiary} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper, gap: spacing.sm,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
