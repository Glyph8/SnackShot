import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import type { Decision, DecisionCategory } from '@/types/domain';
import type { EditParams } from '@/stores/inbox';

const CATEGORIES: { value: DecisionCategory; label: string }[] = [
  { value: 'investment', label: '투자' },
  { value: 'relationship', label: '관계' },
  { value: 'career', label: '커리어' },
  { value: 'daily', label: '일상' },
  { value: 'other', label: '기타' },
];

interface Props {
  visible: boolean;
  decision: Decision;
  onSave(edits: EditParams): void;
  onCancel(): void;
}

export function EditDecisionSheet({ visible, decision, onSave, onCancel }: Props) {
  const [summary, setSummary] = useState(decision.userSummary ?? decision.summary);
  const [category, setCategory] = useState<DecisionCategory>(
    decision.userCategory ?? decision.category,
  );
  // 남은 일수로 초기화 (없으면 빈 문자열)
  const [daysStr, setDaysStr] = useState(() => {
    if (!decision.followUpAt) return '';
    const remaining = Math.ceil((decision.followUpAt - Date.now()) / 86_400_000);
    return remaining > 0 ? String(remaining) : '';
  });

  function handleSave() {
    const edits: EditParams = {};
    const trimmed = summary.trim();
    if (trimmed) edits.userSummary = trimmed;
    edits.userCategory = category;
    const days = parseInt(daysStr, 10);
    if (!isNaN(days) && days > 0) {
      edits.followUpAt = Date.now() + days * 86_400_000;
    }
    onSave(edits);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <Text style={styles.title}>결정 수정</Text>
          <Pressable onPress={handleSave} hitSlop={12}>
            <Text style={styles.save}>저장 · 컨펌</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>요약</Text>
          <TextInput
            style={styles.textArea}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={3}
            placeholder="결정 내용을 입력하세요"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.label}>카테고리</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                style={[styles.catBtn, category === c.value && styles.catSelected]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.catTxt, category === c.value && styles.catSelectedTxt]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>후속 확인 (N일 후)</Text>
          <TextInput
            style={[styles.textArea, styles.inputSm]}
            value={daysStr}
            onChangeText={setDaysStr}
            keyboardType="number-pad"
            placeholder="예: 7"
            placeholderTextColor="#bbb"
          />
          <Text style={styles.hint}>비워두면 후속 확인을 설정하지 않습니다.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  cancel: { fontSize: 15, color: '#888' },
  save: { fontSize: 15, color: '#111', fontWeight: '700' },

  body: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 20 },
  textArea: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#111',
    textAlignVertical: 'top', minHeight: 80,
    backgroundColor: '#fafafa',
  },
  inputSm: { minHeight: 44 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  catSelected: { backgroundColor: '#111', borderColor: '#111' },
  catTxt: { fontSize: 13, color: '#666', fontWeight: '500' },
  catSelectedTxt: { color: '#fff', fontWeight: '700' },
  hint: { fontSize: 12, color: '#aaa', marginTop: 6 },
});
