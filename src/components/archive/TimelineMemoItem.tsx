import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, LinedPaper, Tag } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Entry } from '@/types/domain';

const MEMO_LINE_GAP = 28; // 메모지 괘선 간격 = 입력 줄높이

// 타임라인의 메모(텍스트 엔트리) — 썸네일 없이 본문만 보여주고, 탭하면 그 자리에서 메모지에 바로 수정.
interface Props {
  entry: Entry;
  onSave(text: string): void;
  onDelete(): void;
}

export function TimelineMemoItem({ entry, onSave, onDelete }: Props) {
  const body = entry.manualNote ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const time = format(new Date(entry.recordedAt), 'M월 d일 a h:mm', { locale: ko });

  if (editing) {
    return (
      <View style={styles.card}>
        {/* 메모지 괘선 위에 글씨 쓰는 느낌 */}
        <LinedPaper torn lineGap={MEMO_LINE_GAP} padding={spacing.md} style={styles.editPaper}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            textAlignVertical="top"
            placeholder="메모를 적어보세요…"
            placeholderTextColor={colors.text.tertiary}
          />
        </LinedPaper>
        <View style={styles.actions}>
          <Button label="삭제" variant="quiet" size="sm" onPress={onDelete} />
          <View style={styles.spacer} />
          <Button label="취소" variant="quiet" size="sm" onPress={() => { setDraft(body); setEditing(false); }} />
          <Button
            label="저장"
            variant="primary"
            size="sm"
            disabled={!draft.trim()}
            onPress={() => { onSave(draft.trim()); setEditing(false); }}
          />
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={() => { setDraft(body); setEditing(true); }}>
      <Card style={styles.card}>
        <View style={styles.metaRow}>
          <AppText preset="caption" color={colors.text.tertiary}>{time}</AppText>
          <Tag label="메모" bg={colors.surface.sunken} color={colors.text.secondary} />
        </View>
        {body ? (
          <AppText preset="bodyMedium" color={colors.text.primary} numberOfLines={4}>{body}</AppText>
        ) : (
          <AppText preset="bodySmall" color={colors.text.tertiary}>내용 없음 · 탭하여 작성</AppText>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editPaper: { marginBottom: spacing.xs },
  input: {
    fontSize: 16, lineHeight: MEMO_LINE_GAP, color: colors.text.primary,
    padding: 0, minHeight: 84, textAlignVertical: 'top', backgroundColor: 'transparent',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacer: { flex: 1 },
});
