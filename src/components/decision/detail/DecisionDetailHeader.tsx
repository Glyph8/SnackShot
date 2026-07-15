import { StyleSheet, View } from 'react-native';

import { decisionCategoryLabel } from '@/components/DecisionCardBody';
import { AppText, Tag } from '@/components/ui';
import { parseTradeDetails } from '@/services/trade/schema';
import { colors, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

// I1: 결정 상세 헤더 — 요약(user 우선) + 칩 행(카테고리·상태·확신·origin·티커).
// 카테고리 색은 I4에서 토큰화 예정(지금은 기본 Tag 스타일).

type DState = 'deliberating' | 'rejected' | 'done' | 'active';

function stateOf(d: Decision): DState {
  if (d.status === 'deliberating') return 'deliberating';
  if (d.status === 'rejected') return 'rejected';
  if (d.executedAt != null) return 'done';
  return 'active';
}

const STATE_META: Record<DState, { label: string; color: string }> = {
  active: { label: '진행 중', color: colors.brand.primary },
  done: { label: '완료', color: colors.feedback.success },
  rejected: { label: '반려', color: colors.text.tertiary },
  deliberating: { label: '미결', color: colors.feedback.warning },
};

export function DecisionDetailHeader({ decision }: { decision: Decision }) {
  const summary = decision.userSummary ?? decision.summary;
  const meta = STATE_META[stateOf(decision)];
  const confidence = Math.round((decision.userConfidence ?? decision.confidence) * 100);
  const originLabel = decision.origin === 'authored' ? '✍ 작성' : '🎙 발굴';
  const ticker = parseTradeDetails(decision.structuredJson)?.ticker;

  return (
    <View style={styles.wrap}>
      <AppText preset="titleMedium">{summary}</AppText>
      <View style={styles.chips}>
        <Tag label={decisionCategoryLabel(decision)} />
        <Tag label={meta.label} bg={colors.surface.sunken} color={meta.color} />
        <Tag label={`확신 ${confidence}%`} bg={colors.surface.sunken} color={colors.text.secondary} />
        <Tag label={originLabel} bg={colors.surface.sunken} color={colors.text.secondary} />
        {ticker && <Tag label={ticker} bg={colors.surface.sunken} color={colors.text.secondary} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
