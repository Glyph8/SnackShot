import { HandDrawnBorder, Icon } from '@/components/ui';
import {
  ActivityIndicator, type LayoutChangeEvent, Pressable, StyleSheet, TextInput, View,
} from 'react-native';

import { CaptureBar } from '@/components/CaptureBar';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

// today.tsx에서 분리 (P3). 하단 고정 입력 바(인라인 메모) + 캡처 바 — 순수 프레젠테이션.

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
  return (
    <View style={[styles.composer, { paddingBottom: spacing.sm }]} onLayout={onLayout}>
      <View style={styles.memoRow}>
        <HandDrawnBorder shape="underline" color={colors.border.dashed} inset={spacing.lg} />
        <Icon name="text" size={iconSize.md} color={colors.text.tertiary} />
        <TextInput
          style={styles.memoInput}
          placeholder="오늘 한 줄, 직접 쓰기…"
          placeholderTextColor={colors.text.tertiary}
          value={memo}
          onChangeText={onChangeMemo}
          onSubmitEditing={onSubmit}
          returnKeyType="done"
          blurOnSubmit
          editable={!addingMemo}
        />
        {memo.trim().length > 0 && (
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
  memoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface.sunken,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: layout.minTouch,
  },
  memoInput: { flex: 1, fontSize: 15, color: colors.text.primary, padding: 0 },
  sendBtn: {
    width: 32, height: 32, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
