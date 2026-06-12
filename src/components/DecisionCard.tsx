import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Decision } from '@/types/domain';

const CATEGORY_LABELS: Record<string, string> = {
  investment: '투자',
  relationship: '관계',
  career: '커리어',
  daily: '일상',
  other: '기타',
};

const CATEGORY_COLORS: Record<string, string> = {
  investment: '#0ea5e9',
  relationship: '#ec4899',
  career: '#8b5cf6',
  daily: '#22c55e',
  other: '#94a3b8',
};

interface Props {
  decision: Decision;
  onConfirm(): void;
  onReject(): void;
  onEdit(): void;
}

export function DecisionCard({ decision, onConfirm, onReject, onEdit }: Props) {
  const displaySummary = decision.userSummary ?? decision.summary;
  const category = decision.userCategory ?? decision.category;
  const { confidence } = decision;

  const confColor = confidence >= 0.7 ? '#22c55e' : confidence >= 0.5 ? '#eab308' : '#ef4444';
  const catColor = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.catBadge, { backgroundColor: catColor + '22' }]}>
          <Text style={[styles.catText, { color: catColor }]}>
            {CATEGORY_LABELS[category] ?? category}
          </Text>
        </View>
        <View style={styles.confTrack}>
          <View style={[styles.confFill, { flex: confidence, backgroundColor: confColor }]} />
          <View style={{ flex: 1 - confidence }} />
        </View>
        <Text style={[styles.confPct, { color: confColor }]}>
          {Math.round(confidence * 100)}%
        </Text>
      </View>

      <Text style={styles.summary}>{displaySummary}</Text>

      {!!decision.evidenceQuote && (
        <Text style={styles.evidence}>"{decision.evidenceQuote}"</Text>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.rejectBtn} onPress={onReject}>
          <Text style={styles.rejectTxt}>결정 아님</Text>
        </Pressable>
        <Pressable style={styles.editBtn} onPress={onEdit}>
          <Text style={styles.editTxt}>수정</Text>
        </Pressable>
        <Pressable style={styles.confirmBtn} onPress={onConfirm}>
          <Text style={styles.confirmTxt}>컨펌 ✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginVertical: 6,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  catText: { fontSize: 11, fontWeight: '700' },
  confTrack: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: '#f0f0f0',
    flexDirection: 'row', overflow: 'hidden',
  },
  confFill: { borderRadius: 2 },
  confPct: { fontSize: 12, fontWeight: '600', minWidth: 34, textAlign: 'right' },

  summary: { fontSize: 15, fontWeight: '600', color: '#111', lineHeight: 22 },
  evidence: { fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 19 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rejectBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#f5f5f5', alignItems: 'center',
  },
  rejectTxt: { fontSize: 13, color: '#888', fontWeight: '500' },
  editBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#f0f4ff', alignItems: 'center',
  },
  editTxt: { fontSize: 13, color: '#4f6ef7', fontWeight: '600' },
  confirmBtn: {
    flex: 1.4, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#111', alignItems: 'center',
  },
  confirmTxt: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
