import { Icon, LinedPaper } from '@/components/ui';
import {
  ActivityIndicator, type LayoutChangeEvent, Pressable, StyleSheet, TextInput, View,
} from 'react-native';

import { CaptureBar } from '@/components/CaptureBar';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

// today.tsx에서 분리 (P3). 하단 고정 입력 바 — 메모지(라인 노트) 위에 직접 쓰기 + 캡처 바.
// 메모는 멀티라인이라 길어지면 위로 늘어나고, 괘선이 줄마다 글자 아래에 깔린다.

const LINE_GAP = 28; // 괘선 간격 = 입력 줄높이

export interface TodayComposerProps {
  memo: string;
  addingMemo: boolean;
  onChangeMemo(v: string): void;
  onSubmit(): void;
  onLayout(e: LayoutChangeEvent): void;
  onUpload(): void;
  onAudio(): void;
  onVideo(): void;
}

export function TodayComposer({
  memo, addingMemo, onChangeMemo, onSubmit, onLayout, onUpload, onAudio, onVideo,
}: TodayComposerProps) {
  const hasText = memo.trim().length > 0;
  return (
    <View style={[styles.composer, { paddingBottom: spacing.sm }]} onLayout={onLayout}>
      <View style={styles.memoRow}>
        {/* 메모지 — 괘선 위에 직접 쓰기. 멀티라인이라 길어지면 위로 늘어난다 */}
        <LinedPaper torn lineGap={LINE_GAP} padding={spacing.md} style={styles.memoPaper}>
          <TextInput
            style={styles.memoInput}
            placeholder="오늘 한 줄, 직접 쓰기…"
            placeholderTextColor={colors.text.tertiary}
            value={memo}
            onChangeText={onChangeMemo}
            multiline
            editable={!addingMemo}
            textAlignVertical="top"
          />
        </LinedPaper>
        {hasText && (
          <Pressable onPress={onSubmit} disabled={addingMemo} hitSlop={spacing.sm} style={styles.sendBtn}>
            {addingMemo
              ? <ActivityIndicator size="small" color={colors.brand.onPrimary} />
              : <Icon name="arrow-up" size={iconSize.md} color={colors.brand.onPrimary} />}
          </Pressable>
        )}
      </View>
      <CaptureBar onUpload={onUpload} onAudio={onAudio} onVideo={onVideo} />
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.hairline,
  },
  // 입력이 늘어나도 보내기 버튼은 바닥에 정렬
  memoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  memoPaper: { flex: 1 },
  memoInput: {
    fontSize: 16, lineHeight: LINE_GAP, color: colors.text.primary,
    padding: 0, textAlignVertical: 'top',
    minHeight: LINE_GAP, maxHeight: LINE_GAP * 6, // 한 줄~여섯 줄, 그 이상은 내부 스크롤
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
