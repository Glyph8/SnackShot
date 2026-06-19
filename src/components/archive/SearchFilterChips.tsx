import { startOfDay, subMonths, subYears } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { EntryTypeFilter, SearchFilters } from '@/db/repos/transcripts';
import { colors, radius, spacing } from '@/theme';

// 검색 결과를 좁히는 칩. 두 축을 UI로 분리한다(같은 속성처럼 보이지 않도록):
//  - 종류·결정: 다중 선택(여러 개 동시 활성), 줄바꿈 배치(가로 스크롤 없음)
//  - 기간: 단일 선택, 구분선 아래 별도 그룹
interface Props {
  filters: SearchFilters;
  onChange(partial: Partial<SearchFilters>): void;
}

const TYPES: { key: EntryTypeFilter; label: string }[] = [
  { key: 'video', label: '영상' },
  { key: 'audio', label: '음성' },
  { key: 'text', label: '텍스트' },
];

export function SearchFilterChips({ filters, onChange }: Props) {
  const now = startOfDay(new Date());
  const periods = [
    { key: '1m', label: '1개월', since: subMonths(now, 1).getTime() },
    { key: '3m', label: '3개월', since: subMonths(now, 3).getTime() },
    { key: '1y', label: '1년', since: subYears(now, 1).getTime() },
  ];

  const types = filters.types ?? [];
  const toggleType = (t: EntryTypeFilter) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    onChange({ types: next.length ? next : undefined });
  };

  return (
    <View style={styles.wrap}>
      {/* 종류 + 결정 — 다중 선택 */}
      <View style={styles.group}>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} active={types.includes(t.key)} onPress={() => toggleType(t.key)} />
        ))}
        <Chip
          label="결정 포함"
          active={!!filters.decisionOnly}
          onPress={() => onChange({ decisionOnly: !filters.decisionOnly })}
        />
      </View>

      {/* 기간 — 단일 선택, 구분선으로 분리 */}
      <View style={styles.periodGroup}>
        {periods.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            active={filters.sinceMs === p.since}
            onPress={() => onChange({ sinceMs: filters.sinceMs === p.since ? undefined : p.since })}
          />
        ))}
      </View>
    </View>
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
  wrap: { paddingBottom: spacing.sm },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  periodGroup: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border.hairline,
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
    backgroundColor: colors.surface.sunken, borderWidth: 1, borderColor: colors.border.card,
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
});
