import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { AppText, Button, CollapsibleSection, Icon, PostIt, Tag } from '@/components/ui';
import {
  getAllDecisions, getDecisionPerformance, getDecisionsOnThisDay,
  getOutcomeByDecision, getRelatedDecisions, updateUserEdit,
} from '@/db';
import type { DecisionPerformance, RelatedDecision } from '@/db';
import { nowMs } from '@/lib/time';
import { DecisionStats } from './DecisionStats';
import { DecisionOnThisDay, type DecisionOnThisDayItem } from './DecisionOnThisDay';
import { syncFollowUpForDecision } from '@/services/followUpNotifications';
import { revertDecisionToTodo } from '@/services/revertDecisionToTodo';
import type { EditParams } from '@/stores/inbox';
import { parseTradeDetails, formatTradeDetails } from '@/services/trade/schema';
import { colors, layout, radius, spacing } from '@/theme';
import type { Decision, Outcome } from '@/types/domain';

// 처리된 결정 전체 목록 — /decisions 화면과 Inbox '전체 목록' 탭이 공유하는 본문.
// (헤더/뒤로가기 없이 필터 칩 + 카드 리스트 + 편집 시트만 담당.)

type DState = 'active' | 'done' | 'rejected' | 'deliberating';
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
  if (d.status === 'deliberating') return 'deliberating';
  if (d.status === 'rejected') return 'rejected';
  if (d.executedAt != null) return 'done';
  return 'active';
}

// 포스트잇(파스텔) 위에서도 읽히는 잉크색
const STATE_META: Record<DState, { label: string; color: string }> = {
  active: { label: '진행 중', color: colors.text.onStickyMuted },
  done: { label: '완료', color: colors.feedback.success },
  rejected: { label: '반려', color: colors.text.onStickyFaint },
  deliberating: { label: '미결', color: colors.text.onStickyMuted },
};

export function DecisionList({ bottomInset = 0, showInsights = false }: { bottomInset?: number; showInsights?: boolean }) {
  const db = useSQLiteContext();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome | null>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Decision | null>(null);
  const [performance, setPerformance] = useState<DecisionPerformance | null>(null);
  const [onThisDay, setOnThisDay] = useState<DecisionOnThisDayItem[]>([]);
  const [related, setRelated] = useState<Record<string, (RelatedDecision & { outcome: Outcome | null })[]>>({});

  const load = useCallback(async () => {
    try {
      const rows = await getAllDecisions(db);
      setDecisions(rows);
      if (showInsights) {
        const [perf, otd] = await Promise.all([
          getDecisionPerformance(db),
          getDecisionsOnThisDay(db, nowMs()),
        ]);
        const otdItems = await Promise.all(
          otd.map(async (decision) => ({ decision, outcome: await getOutcomeByDecision(db, decision.id) })),
        );
        setPerformance(perf);
        setOnThisDay(otdItems);
      }
    } catch (e) {
      console.error('[decisions] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [db, showInsights]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExpand = useCallback(async (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    if (!(id in outcomes)) {
      const o = await getOutcomeByDecision(db, id);
      setOutcomes((m) => ({ ...m, [id]: o }));
    }
    if (!(id in related)) {
      const rel = await getRelatedDecisions(db, id);
      const withOutcome = await Promise.all(
        rel.map(async (r) => ({ ...r, outcome: await getOutcomeByDecision(db, r.decision.id) })),
      );
      setRelated((m) => ({ ...m, [id]: withOutcome }));
    }
  }, [db, outcomes, related]);

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
    await syncFollowUpForDecision(db, target.id);
    await load();
  }, [db, editing, load]);

  const filtered = decisions.filter((d) => filter === 'all' || stateOf(d) === filter);

  return (
    <>
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
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: bottomInset + spacing['4xl'] }]}>
          {showInsights && (
            <>
              <CollapsibleSection title="통계" hint="회고 대시보드">
                {performance ? <DecisionStats performance={performance} /> : null}
              </CollapsibleSection>
              <Button
                label="📷 증권앱 캡처로 포트폴리오 가져오기"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/portfolio-import')}
                fullWidth
                style={styles.portfolioBtn}
              />
              <DecisionOnThisDay items={onThisDay} onPress={(d) => setEditing(d)} />
            </>
          )}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="idea" size={48} color={colors.text.tertiary} />
              <AppText preset="bodyMedium" color={colors.text.tertiary}>해당하는 결정이 없어요</AppText>
            </View>
          ) : (
            filtered.map((d) => (
              <DecisionManageCard
                key={d.id}
                decision={d}
                outcome={outcomes[d.id]}
                related={related[d.id]}
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
    </>
  );
}

function DecisionManageCard(props: {
  decision: Decision;
  outcome: Outcome | null | undefined;
  related?: (RelatedDecision & { outcome: Outcome | null })[];
  expanded: boolean;
  onToggle(): void;
  onEdit(): void;
  onRevert(): void;
}) {
  const { decision: d, outcome, related, expanded } = props;
  const summary = d.userSummary ?? d.summary;
  const situation = d.userSituation ?? d.situation;
  const reasoning = d.userReasoning ?? d.reasoning;
  const trade = parseTradeDetails(d.structuredJson);
  const state = stateOf(d);
  const meta = STATE_META[state];
  const dateMs = d.confirmedAt ?? d.extractedAt;

  return (
    <PostIt vary={d.id} lift containerStyle={styles.cardOuter} style={styles.card}>
      <Pressable onPress={props.onToggle}>
        <View style={styles.topRow}>
          <Tag label={decisionCategoryLabel(d)} />
          <AppText preset="caption" color={meta.color}>{meta.label}</AppText>
        </View>
        <AppText preset="cardTitle" color={colors.text.onSticky} numberOfLines={expanded ? undefined : 2}>{summary}</AppText>
        <AppText preset="caption" color={colors.text.onStickyFaint}>
          {format(new Date(dateMs), 'yyyy. M. d', { locale: ko })}
        </AppText>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          <Field label="상황" value={situation} />
          <Field label="대안" value={d.alternatives} />
          <Field label="이유" value={reasoning} />
          <Field label="예상 결과" value={d.expectedOutcome} />
          {trade && <Field label="매매" value={formatTradeDetails(trade)} />}
          {outcome && (
            <Field
              label="결과"
              value={`${RESULT_LABEL[outcome.result] ?? outcome.result}${outcome.reflection ? `\n${outcome.reflection}` : ''}`}
            />
          )}
          {outcome?.learnings ? <Field label="교훈" value={outcome.learnings} /> : null}
          {related && related.length > 0 && (
            <View style={styles.field}>
              <AppText preset="caption" color={colors.text.onStickyFaint}>연관 결정</AppText>
              {related.map((r) => (
                <View key={r.link.id} style={styles.relatedRow}>
                  <AppText preset="bodyMedium" color={colors.text.onSticky} numberOfLines={1} style={styles.flex1}>
                    {r.decision.userSummary ?? r.decision.summary}
                  </AppText>
                  {r.outcome && (
                    <AppText preset="caption" color={colors.text.onStickyMuted}>
                      {RESULT_LABEL[r.outcome.result] ?? r.outcome.result}
                    </AppText>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Button label="편집" variant="secondary" size="sm" onPress={props.onEdit} style={styles.flex1} />
            {state !== 'active' && (
              <Button label="Todo로 되돌리기" variant="quiet" size="sm" onPress={props.onRevert} style={styles.flexWide} />
            )}
          </View>
        </View>
      )}
    </PostIt>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <AppText preset="caption" color={colors.text.onStickyFaint}>{label}</AppText>
      <AppText preset="bodyMedium" color={colors.text.onSticky}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  portfolioBtn: { marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  filterOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  loader: { marginTop: spacing['4xl'] },
  list: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.sm },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing['5xl'] },

  cardOuter: { marginBottom: spacing.md },
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detail: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.accent.noteFold, paddingTop: spacing.md },
  field: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex1: { flex: 1 },
  relatedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flexWide: { flex: 1.4 },
});
