import { startOfDay, subMonths, subYears } from 'date-fns';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui';
import type { SearchFilters } from '@/db/repos/transcripts';
import { colors, radius, spacing } from '@/theme';

// 검색 결과를 좁히는 칩 줄 — 타입(영상/음성)·결정 포함·기간. 순수 프레젠테이션.
// 기간 sinceMs는 startOfDay 기준으로 계산해 하루 내 렌더 간 active 비교가 안정적이다.
interface Props {
  filters: SearchFilters;
  onChange(partial: Partial<SearchFilters>): void;
}

export function SearchFilterChips({ filters, onChange }: Props) {
  const now = startOfDay(new Date());
  const periods = [
    { key: '1m', label: '1개월', since: subMonths(now, 1).getTime() },
    { key: '3m', label: '3개월', since: subMonths(now, 3).getTime() },
    { key: '1y', label: '1년', since: subYears(now, 1).getTime() },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <Chip
        label="영상"
        active={filters.type === 'video'}
        onPress={() => onChange({ type: filters.type === 'video' ? undefined : 'video' })}
      />
      <Chip
        label="음성"
        active={filters.type === 'audio'}
        onPress={() => onChange({ type: filters.type === 'audio' ? undefined : 'audio' })}
      />
      <Chip
        label="결정 포함"
        active={!!filters.decisionOnly}
        onPress={() => onChange({ decisionOnly: !filters.decisionOnly })}
      />
      {periods.map((p) => (
        <Chip
          key={p.key}
          label={p.label}
          active={filters.sinceMs === p.since}
          onPress={() => onChange({ sinceMs: filters.sinceMs === p.since ? undefined : p.since })}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) {
  return (
    <Pressable onPress={onPress} hitSlop={spacing.xs} style={[styles.chip, active && styles.chipActive]}>
      <AppText preset="caption" color={active ? colors.brand.onPrimary : colors.text.secondary}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
    backgroundColor: colors.surface.sunken, borderWidth: 1, borderColor: colors.border.card,
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
});
