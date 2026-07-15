import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Decision, Outcome, OutcomeResult } from '@/types/domain';

// I1: 회고 타임라인 — 고정 이벤트(기록·확정·수행)와 회고(outcome, soft-deleted 포함)를
// created_at/시각 기준 최신순으로 병합. deleted_at 회고는 "잠정 판단(재확인으로 되돌림)"(F4)으로
// 열람만(복원 액션 없음).

const RESULT_LABEL: Record<OutcomeResult, string> = {
  good: '좋았음 👍', bad: '아쉬움 👎', mixed: '반반 🤔', unclear: '기억 안 남', skipped: '건너뜀',
};

interface TLEvent {
  ts: number;
  title: string;
  detail?: string;
  muted?: boolean;
}

function buildEvents(decision: Decision, outcomes: Outcome[]): TLEvent[] {
  const events: TLEvent[] = [];
  events.push({ ts: decision.extractedAt, title: '기록됨' });
  if (decision.confirmedAt != null) events.push({ ts: decision.confirmedAt, title: '확정됨' });
  if (decision.executedAt != null) events.push({ ts: decision.executedAt, title: '수행함' });
  for (const o of outcomes) {
    const reverted = o.deletedAt != null;
    const resultLabel = RESULT_LABEL[o.result] ?? o.result;
    const parts = [o.reflection, o.learnings ? `교훈: ${o.learnings}` : null].filter(Boolean) as string[];
    events.push({
      ts: o.createdAt,
      title: reverted ? `잠정 판단 · ${resultLabel} (재확인으로 되돌림)` : `회고 · ${resultLabel}`,
      detail: parts.length ? parts.join('\n') : undefined,
      muted: reverted,
    });
  }
  return events.sort((a, b) => b.ts - a.ts);
}

export function OutcomeTimeline({ decision, outcomes }: { decision: Decision; outcomes: Outcome[] }) {
  const events = buildEvents(decision, outcomes);
  return (
    <View style={styles.wrap}>
      <AppText preset="caption" color={colors.text.tertiary}>회고 타임라인</AppText>
      {events.map((e, i) => (
        <View key={`${e.ts}-${i}`} style={styles.row}>
          <View style={[styles.dot, e.muted && styles.dotMuted]} />
          <View style={styles.rowBody}>
            <View style={styles.rowHead}>
              <AppText preset="bodyMedium" color={e.muted ? colors.text.tertiary : colors.text.primary}>
                {e.title}
              </AppText>
              <AppText preset="caption" color={colors.text.tertiary}>
                {format(new Date(e.ts), 'yyyy. M. d', { locale: ko })}
              </AppText>
            </View>
            {e.detail && (
              <AppText preset="bodySmall" color={colors.text.secondary}>{e.detail}</AppText>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  dot: {
    width: 8, height: 8, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary, marginTop: spacing.xs,
  },
  dotMuted: { backgroundColor: colors.text.tertiary },
  rowBody: { flex: 1, gap: spacing.xs },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
