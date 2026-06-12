import { format } from 'date-fns';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Decision } from '@/types/domain';

interface Props {
  decision: Decision;
  onResult(result: 'good' | 'bad' | 'skipped'): void;
}

export function FollowUpCard({ decision, onResult }: Props) {
  const displaySummary = decision.userSummary ?? decision.summary;
  const dueLabel = decision.followUpAt
    ? format(new Date(decision.followUpAt), 'M월 d일')
    : null;

  return (
    <View style={styles.card}>
      {dueLabel && <Text style={styles.dueLabel}>{dueLabel} 예정</Text>}
      <Text style={styles.summary}>{displaySummary}</Text>
      <Text style={styles.question}>결과가 어땠어요?</Text>

      <View style={styles.grid}>
        <Pressable style={[styles.btn, styles.good]} onPress={() => onResult('good')}>
          <Text style={styles.btnTxt}>좋았음 👍</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.bad]} onPress={() => onResult('bad')}>
          <Text style={styles.btnTxt}>아쉬움 👎</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.skip]} onPress={() => onResult('skipped')}>
          <Text style={styles.btnTxt}>기억 안 남</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.video]}
          onPress={() =>
            router.push({ pathname: '/record', params: { decisionId: decision.id } })
          }
        >
          <Text style={styles.btnTxt}>영상으로 ▸</Text>
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
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#eab308',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dueLabel: { fontSize: 11, color: '#b45309', fontWeight: '600' },
  summary: { fontSize: 15, fontWeight: '600', color: '#111', lineHeight: 22 },
  question: { fontSize: 13, color: '#666', marginBottom: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    flex: 1, minWidth: '45%', paddingVertical: 9,
    borderRadius: 8, alignItems: 'center',
  },
  btnTxt: { fontSize: 13, fontWeight: '600', color: '#111' },
  good: { backgroundColor: '#dcfce7' },
  bad: { backgroundColor: '#fee2e2' },
  skip: { backgroundColor: '#f5f5f5' },
  video: { backgroundColor: '#eff6ff' },
});
