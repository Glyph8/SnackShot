import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Entry, Transcript } from '@/types/domain';

// entry/[id].tsx에서 분리 (P3). 트랜스크립트/메모 표시·편집 섹션 — 순수 프레젠테이션.
// 편집/재생성 상태와 핸들러는 부모(EntryDetailScreen)가 props로 주입한다.

export interface EntryTextSectionProps {
  entry: Entry;
  transcript: Transcript | null;
  editTarget: 'transcript' | 'note' | null;
  editValue: string;
  regenerating: boolean;
  sttInProgress: boolean;
  engineLabel: string | null;
  onChangeEditValue(v: string): void;
  onCancelEdit(): void;
  onSaveEdit(): void;
  onOpenEdit(target: 'transcript' | 'note'): void;
  onRegenerate(): void;
}

export function EntryTextSection({
  entry, transcript, editTarget, editValue, regenerating, sttInProgress, engineLabel,
  onChangeEditValue, onCancelEdit, onSaveEdit, onOpenEdit, onRegenerate,
}: EntryTextSectionProps) {
  return (
    <Card style={styles.section}>
      <AppText preset="caption" color={colors.text.tertiary} style={styles.sectionTitle}>텍스트</AppText>

      {editTarget ? (
        <>
          <TextInput
            style={styles.editor}
            value={editValue}
            onChangeText={onChangeEditValue}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <View style={styles.actionRow}>
            <Pressable onPress={onCancelEdit} style={styles.actionBtn}>
              <AppText preset="button" color={colors.text.secondary}>취소</AppText>
            </Pressable>
            <Pressable onPress={onSaveEdit} style={styles.actionBtn}>
              <AppText preset="button" color={colors.text.link}>저장</AppText>
            </Pressable>
          </View>
        </>
      ) : transcript ? (
        <>
          <AppText preset="bodyMedium">{transcript.editedText ?? transcript.rawText}</AppText>
          {engineLabel && <AppText preset="caption" color={colors.text.tertiary}>{engineLabel}</AppText>}
          <View style={styles.actionRow}>
            <Pressable onPress={() => onOpenEdit('transcript')} style={styles.actionBtn}>
              <AppText preset="caption" color={colors.text.link}>편집</AppText>
            </Pressable>
            {entry.mode === 'voice' && (
              <Pressable onPress={onRegenerate} disabled={regenerating} style={styles.actionBtn}>
                <AppText preset="caption" color={regenerating ? colors.text.tertiary : colors.text.link}>재생성</AppText>
              </Pressable>
            )}
          </View>
        </>
      ) : sttInProgress ? (
        <AppText preset="bodyMedium" color={colors.text.tertiary}>음성을 텍스트로 변환 중…</AppText>
      ) : (entry.mode === 'silent' || entry.mode === 'text') ? (
        <>
          <AppText preset="bodyMedium">{entry.manualNote ?? '메모 없음'}</AppText>
          <View style={styles.actionRow}>
            <Pressable onPress={() => onOpenEdit('note')} style={styles.actionBtn}>
              <AppText preset="caption" color={colors.text.link}>편집</AppText>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <AppText preset="bodyMedium" color={colors.text.tertiary}>
            {entry.sttStatus === 'failed'
              ? 'STT 실패 — 재시도해 보세요'
              : entry.sttStatus === 'skipped'
                ? '음성 없음 — 필요하면 재시도'
                : '트랜스크립트 없음'}
          </AppText>
          {entry.mode === 'voice' && (
            <Pressable onPress={onRegenerate} disabled={regenerating} style={styles.actionBtn}>
              <AppText preset="caption" color={regenerating ? colors.text.tertiary : colors.text.link}>
                {regenerating ? '재생성 중…' : '재시도'}
              </AppText>
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  actionBtn: { paddingVertical: spacing.xs },
  editor: {
    fontSize: 15, color: colors.text.primary, lineHeight: 22,
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    padding: spacing.md, minHeight: 120,
  },
});
