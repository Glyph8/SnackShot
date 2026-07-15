import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Icon, PostIt, Tag } from '@/components/ui';
import { getAllDecisions } from '@/db';
import { colors, radius, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

// 처리된 결정 전체 목록(결정 탭 '전체 기록'). 필터 칩 + 카드만 — 스크롤/통계/보드는 부모(결정 탭)가 소유.
// 카드 탭 → 결정 상세 /decision/[id] (I1).

type DState = 'active' | 'done' | 'rejected' | 'deliberating';
type Filter = 'all' | DState;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행 중' },
  { value: 'done', label: '완료' },
  { value: 'rejected', label: '반려' },
];

function stateOf(d: Decision): DState {
  if (d.status === 'deliberating') return 'deliberating';
  if (d.status === 'rejected') return 'rejected';
  if (d.executedAt != null) return 'done';
  return 'active';
}

const STATE_META: Record<DState, { label: string; color: string }> = {
  active: { label: '진행 중', color: colors.text.onStickyMuted },
  done: { label: '완료', color: colors.feedback.success },
  rejected: { label: '반려', color: colors.text.onStickyFaint },
  deliberating: { label: '미결', color: colors.text.onStickyMuted },
};

export function DecisionList() {
  const db = useSQLiteContext();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      setDecisions(await getAllDecisions(db));
    } catch (e) {
      console.error('[decisions] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = decisions.filter((d) => filter === 'all' || stateOf(d) === filter);

  return (
    <View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const on = filter === f.value;
          return (
            <Pressable key={f.value} style={[styles.filterChip, on && styles.filterOn]} onPress={() => setFilter(f.value)}>
              <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>{f.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="idea" size={48} color={colors.text.tertiary} />
          <AppText preset="bodyMedium" color={colors.text.tertiary}>해당하는 결정이 없어요</AppText>
        </View>
      ) : (
        filtered.map((d) => (
          <DecisionManageCard key={d.id} decision={d} onPress={() => router.push(`/decision/${d.id}`)} />
        ))
      )}
    </View>
  );
}

function DecisionManageCard({ decision: d, onPress }: { decision: Decision; onPress(): void }) {
  const summary = d.userSummary ?? d.summary;
  const meta = STATE_META[stateOf(d)];
  const dateMs = d.confirmedAt ?? d.extractedAt;

  return (
    <PostIt vary={d.id} lift containerStyle={styles.cardOuter} style={styles.card}>
      <Pressable onPress={onPress}>
        <View style={styles.topRow}>
          <Tag label={decisionCategoryLabel(d)} />
          <AppText preset="caption" color={meta.color}>{meta.label}</AppText>
        </View>
        <AppText preset="cardTitle" color={colors.text.onSticky} numberOfLines={2}>{summary}</AppText>
        <AppText preset="caption" color={colors.text.onStickyFaint}>
          {format(new Date(dateMs), 'yyyy. M. d', { locale: ko })}
        </AppText>
      </Pressable>
    </PostIt>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  filterOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  loader: { marginTop: spacing.xl },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing['4xl'] },
  cardOuter: { marginBottom: spacing.md },
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
