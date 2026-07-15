import { StyleSheet, View } from 'react-native';

import { TradeQuoteCompare } from '@/components/decision/TradeQuoteCompare';
import { AppText, Button } from '@/components/ui';
import type { RelatedDecision } from '@/db';
import { formatTradeDetails, parseTradeDetails } from '@/services/trade/schema';
import { colors, spacing } from '@/theme';
import type { Decision, Outcome } from '@/types/domain';

// I1: 상황·이유·대안(user 우선) + 매매 블록 + 연관 결정 + 액션(원본 보기·수정).
// 화면은 데이터만 넘기고 렌더는 여기서 담당(200줄 규칙).

const RESULT_LABEL: Record<string, string> = {
  good: '좋았음 👍', bad: '아쉬움 👎', mixed: '반반 🤔', unclear: '기억 안 남', skipped: '건너뜀',
};

export function DetailField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <AppText preset="caption" color={colors.text.tertiary}>{label}</AppText>
      <AppText preset="bodyMedium" color={colors.text.primary}>{value}</AppText>
    </View>
  );
}

interface Props {
  decision: Decision;
  related: (RelatedDecision & { outcome: Outcome | null })[];
  /** 매매 블록: 원본 entry 있는 경우에만 '원본 보기' 노출 */
  hasOriginal: boolean;
  onOpenOriginal(): void;
  /** 미결(deliberating)에서는 미전달 — updateUserEdit이 status='edited'를 세팅하므로
   *  미결 편집은 "결정했다" 플로우(decideDeliberating)가 담당한다(상태 오염 방지). */
  onEdit?(): void;
  onPressRelated(id: string): void;
}

export function DecisionDetailBody({
  decision, related, hasOriginal, onOpenOriginal, onEdit, onPressRelated,
}: Props) {
  const situation = decision.userSituation ?? decision.situation;
  const reasoning = decision.userReasoning ?? decision.reasoning;
  const trade = parseTradeDetails(decision.structuredJson);

  return (
    <View style={styles.wrap}>
      <DetailField label="상황" value={situation} />
      <DetailField label="이유" value={reasoning} />
      <DetailField label="대안" value={decision.alternatives} />
      <DetailField label="예상 결과" value={decision.expectedOutcome} />

      {trade && (
        <View style={styles.field}>
          <AppText preset="caption" color={colors.text.tertiary}>매매</AppText>
          <AppText preset="bodyMedium" color={colors.text.primary}>{formatTradeDetails(trade)}</AppText>
          <TradeQuoteCompare decision={decision} />
        </View>
      )}

      {related.length > 0 && (
        <View style={styles.field}>
          <AppText preset="caption" color={colors.text.tertiary}>연관 결정</AppText>
          {related.map((r) => (
            <View key={r.link.id} style={styles.relatedRow}>
              <AppText
                preset="bodyMedium"
                color={colors.brand.primary}
                numberOfLines={1}
                style={styles.flex1}
                onPress={() => onPressRelated(r.decision.id)}
              >
                {r.decision.userSummary ?? r.decision.summary}
              </AppText>
              {r.outcome && (
                <AppText preset="caption" color={colors.text.secondary}>
                  {RESULT_LABEL[r.outcome.result] ?? r.outcome.result}
                </AppText>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {hasOriginal && (
          <Button label="▶ 원본 보기" variant="secondary" size="sm" onPress={onOpenOriginal} style={styles.flex1} />
        )}
        {onEdit && (
          <Button label="✎ 수정" variant="secondary" size="sm" onPress={onEdit} style={styles.flex1} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  field: { gap: spacing.xs },
  relatedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex1: { flex: 1 },
});
