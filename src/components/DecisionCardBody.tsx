import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { StyleSheet, View } from 'react-native';

import { AppText, ConfidenceBar, Tag } from '@/components/ui';
import { colors, iconSize, spacing } from '@/theme';
import type { Decision, Entry } from '@/types/domain';

export const CATEGORY_LABELS: Record<string, string> = {
  investment: '투자',
  relationship: '관계',
  career: '커리어',
  daily: '일상',
  other: '기타',
};

interface Props {
  decision: Decision;
  entry?: Entry;
}

/** 결정 카드 본문(공유) — 카테고리 태그·신뢰도·요약·근거·출처. 리스트/덱 양쪽에서 재사용. */
export function DecisionCardBody({ decision, entry }: Props) {
  const summary = decision.userSummary ?? decision.summary;
  const category = decision.userCategory ?? decision.category;
  const modeIcon = entry?.mode === 'audio' ? 'mic' : entry?.mode === 'text' ? 'create-outline' : 'videocam';

  return (
    <>
      <View style={styles.topRow}>
        <Tag label={CATEGORY_LABELS[category] ?? category} />
        <ConfidenceBar value={decision.confidence * 100} style={styles.conf} />
      </View>

      <AppText preset="cardTitle">{summary}</AppText>

      {!!decision.evidenceQuote && (
        <AppText preset="bodyMedium" color={colors.text.secondary} style={styles.evidence}>
          “{decision.evidenceQuote}”
        </AppText>
      )}

      {entry && (
        <View style={styles.metaRow}>
          <Ionicons name={modeIcon} size={iconSize.sm} color={colors.text.tertiary} />
          <AppText preset="caption" color={colors.text.tertiary}>
            {format(new Date(entry.recordedAt), 'a h:mm', { locale: ko })}
          </AppText>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  conf: { flex: 1 },
  evidence: { fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
