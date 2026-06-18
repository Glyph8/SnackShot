/** @codemap 의사결정 모아보기(/decisions) — 처리된 결정 관리(상세 확장·편집·Todo 되돌리기)
 *  데이터: @/db(getAllDecisions·getOutcomeByDecision·updateUserEdit) · services/revertDecisionToTodo
 *  관련 ADR: 006(컨펌), 016(원본 보존), 017(수행/결과) · 진입: archive
 */
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { AppText, Button, Card, ScreenBackground, Tag } from '@/components/ui';
import { getAllDecisions, getOutcomeByDecision, updateUserEdit } from '@/db';
import { revertDecisionToTodo } from '@/services/revertDecisionToTodo';
import type { EditParams } from '@/stores/inbox';
import { colors, iconSize, layout, radius, spacing } from '@/theme';
import type { Decision, Outcome } from '@/types/domain';

type DState = 'active' | 'done' | 'rejected';
type Filter = 'all' | DState;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행 중' },
  { value: 'done', label: '완료' },
  { value: 'rejected', label: '반려' },
];

const RESULT_LABEL: Record<string, string> = {
  good: '좋았음 👍', bad: '아쉬움 👎', mixed: '반반 🤔', unclear: '기억 안 남', skipped: '건너뜀',
};

function stateOf(d: Decision): DState {
  if (d.status === 'rejected') return 'rejected';
  if (d.executedAt != null) return 'done';
  return 'active';
}

const STATE_META: Record<DState, { label: string; color: string }> = {
  active: { label: '진행 중', color: colors.text.secondary },
  done: { label: '완료', color: colors.feedback.success },
  rejected: { label: '반려', color: colors.text.tertiary },
};

export default function DecisionsScreen() {
  const db = useSQLiteContext();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome | null>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Decision | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await getAllDecisions(db);
      setDecisions(rows);
    } catch (e) {
      console.error('[decisions] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExpand = useCallback(async (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    if (!(id in outcomes)) {
      const o = await getOutcomeByDecision(db, id);
      setOutcomes((m) => ({ ...m, [id]: o }));
    }
  }, [db, outcomes]);

  const handleRevert = useCallback(async (id: string) => {
    await revertDecisionToTodo(db, id);
    setExpandedId(null);
    setOutcomes((m) => { const n = { ...m }; delete n[id]; return n; });
    await load();
  }, [db, load]);

  const handleEditSave = useCallback(async (edits: EditParams) => {
    const target = editing;
    setEditing(null);
    if (!target) return;
    await updateUserEdit(db, target.id, {
      ...edits,
      followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
    });
    await load();
  }, [db, editing, load]);

  const filtered = decisions.filter((d) => filter === 'all' || stateOf(d) === filter);

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.sm} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text.primary} />
        </Pressable>
        <AppText preset="titleMedium">의사결정</AppText>
        <View style={styles.navBtn} />
      </View>

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
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="bulb-outline" size={48} color={colors.text.tertiary} />
              <AppText preset="bodyMedium" color={colors.text.tertiary}>해당하는 결정이 없어요</AppText>
            </View>
          ) : (
            filtered.map((d) => (
              <DecisionManageCard
                key={d.id}
                decision={d}
                outcome={outcomes[d.id]}
                expanded={expandedId === d.id}
                onToggle={() => handleExpand(d.id)}
                onEdit={() => setEditing(d)}
                onRevert={() => handleRevert(d.id)}
              />
            ))
          )}
        </ScrollView>
      )}

      {editing && (
        <EditDecisionSheet
          key={editing.id}
          visible
          decision={editing}
          onCancel={() => setEditing(null)}
          onSave={handleEditSave}
        />
      )}
    </ScreenBackground>
  );
}

function DecisionManageCard(props: {
  decision: Decision;
  outcome: Outcome | null | undefined;
  expanded: boolean;
  onToggle(): void;
  onEdit(): void;
  onRevert(): void;
}) {
  const { decision: d, outcome, expanded } = props;
  const summary = d.userSummary ?? d.summary;
  const situation = d.userSituation ?? d.situation;
  const reasoning = d.userReasoning ?? d.reasoning;
  const state = stateOf(d);
  const meta = STATE_META[state];
  const dateMs = d.confirmedAt ?? d.extractedAt;

  return (
    <Card style={styles.card}>
      <Pressable onPress={props.onToggle}>
        <View style={styles.topRow}>
          <Tag label={decisionCategoryLabel(d)} />
          <AppText preset="caption" color={meta.color}>{meta.label}</AppText>
        </View>
        <AppText preset="cardTitle" numberOfLines={expanded ? undefined : 2}>{summary}</AppText>
        <AppText preset="caption" color={colors.text.tertiary}>
          {format(new Date(dateMs), 'yyyy. M. d', { locale: ko })}
        </AppText>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          <Field label="상황" value={situation} />
          <Field label="대안" value={d.alternatives} />
          <Field label="이유" value={reasoning} />
          <Field label="예상 결과" value={d.expectedOutcome} />
          {outcome && (
            <Field
              label="결과"
              value={`${RESULT_LABEL[outcome.result] ?? outcome.result}${outcome.reflection ? `\n${outcome.reflection}` : ''}`}
            />
          )}

          <View style={styles.actions}>
            <Button label="편집" variant="secondary" size="sm" onPress={props.onEdit} style={styles.flex1} />
            {state !== 'active' && (
              <Button label="Todo로 되돌리기" variant="quiet" size="sm" onPress={props.onRevert} style={styles.flexWide} />
            )}
          </View>
        </View>
      )}
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <AppText preset="caption" color={colors.text.secondary}>{label}</AppText>
      <AppText preset="bodyMedium" color={colors.text.primary}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm,
  },
  navBtn: { width: 36, alignItems: 'flex-start' },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  filterOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  loader: { marginTop: spacing['4xl'] },
  list: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.sm, paddingBottom: spacing['4xl'] },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing['5xl'] },

  card: { marginBottom: spacing.md, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detail: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.hairline, paddingTop: spacing.md },
  field: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex1: { flex: 1 },
  flexWide: { flex: 1.4 },
});
