import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, LinedPaper } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Entry, Transcript } from '@/types/domain';

const LINE_GAP = 28; // 메모지 괘선 간격 = 입력 줄높이

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
  /** 전사 텍스트의 AI 재작성·버전 기록 시트 열기 (v10) */
  onOpenRevision(): void;
  /** 카드 래퍼 없이 본문만(부모가 표면 제공 — 예: 폴라로이드 뒷면) */
  bare?: boolean;
}

export function EntryTextSection({
  entry, transcript, editTarget, editValue, regenerating, sttInProgress, engineLabel,
  onChangeEditValue, onCancelEdit, onSaveEdit, onOpenEdit, onRegenerate, onOpenRevision, bare = false,
}: EntryTextSectionProps) {
  const inner = (
    <>
      <AppText preset="caption" color={colors.text.tertiary} style={styles.sectionTitle}>텍스트</AppText>

      {editTarget ? (
        <>
          {/* Today 메모 수정과 동일 — 찢긴 메모지 괘선 위에 입력 + 취소/저장 버튼 */}
          <LinedPaper torn lineGap={LINE_GAP} padding={spacing.md} style={styles.editorPaper}>
            <TextInput
              style={styles.editor}
              value={editValue}
              onChangeText={onChangeEditValue}
              placeholder={editTarget === 'note' ? '메모를 적어보세요…' : '들린 내용을 다듬어 적어보세요…'}
              placeholderTextColor={colors.text.tertiary}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </LinedPaper>
          <View style={styles.editActions}>
            <Button label="취소" variant="quiet" size="sm" onPress={onCancelEdit} />
            <Button label="저장" variant="primary" size="sm" onPress={onSaveEdit} style={styles.flex1} />
          </View>
        </>
      ) : transcript ? (
        <>
          <AppText preset="bodyMedium">{transcript.editedText ?? transcript.rawText}</AppText>
          {engineLabel && <AppText preset="caption" color={colors.text.tertiary}>{engineLabel}</AppText>}
          <View style={styles.actionRow}>
            <Pressable onPress={() => onOpenEdit('transcript')} style={styles.actionBtn}>
              <AppText preset="caption" color={colors.text.link}>직접 편집</AppText>
            </Pressable>
            <Pressable onPress={onOpenRevision} style={styles.actionBtn}>
              <AppText preset="caption" color={colors.text.link}>AI 재작성 · 기록</AppText>
            </Pressable>
            {entry.mode === 'voice' && (
              <Pressable onPress={onRegenerate} disabled={regenerating} style={styles.actionBtn}>
                <AppText preset="caption" color={regenerating ? colors.text.tertiary : colors.text.link}>STT 재실행</AppText>
              </Pressable>
            )}
          </View>
        </>
      ) : sttInProgress ? (
        <AppText preset="bodyMedium" color={colors.text.tertiary}>음성을 텍스트로 변환 중…</AppText>
      ) : (entry.mode === 'silent' || entry.mode === 'text') ? (
        <>
          {/* 보기 상태도 메모지 위에 — 편집과 동일한 종이 */}
          <LinedPaper torn lineGap={LINE_GAP} padding={spacing.md}>
            <AppText
              preset="bodyMedium"
              color={entry.manualNote ? colors.text.primary : colors.text.tertiary}
              style={styles.noteText}
            >
              {entry.manualNote ?? '메모 없음 · 편집을 눌러 작성'}
            </AppText>
          </LinedPaper>
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
    </>
  );
  return bare
    ? <View style={styles.section}>{inner}</View>
    : <Card style={styles.section}>{inner}</Card>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs },
  actionBtn: { paddingVertical: spacing.xs },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  flex1: { flex: 1 },
  editorPaper: { marginTop: spacing.xs },
  noteText: { fontSize: 16, lineHeight: LINE_GAP, minHeight: LINE_GAP * 2 },
  editor: {
    fontSize: 16, lineHeight: LINE_GAP, color: colors.text.primary,
    padding: 0, minHeight: 120, textAlignVertical: 'top',
    backgroundColor: 'transparent',
  },
});
