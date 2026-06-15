import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface ActionItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress(): void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  onClose(): void;
  items: ActionItem[];
  /** 시트 상단 제목 (선택) */
  title?: string;
}

/** 하단 액션 시트 — 종이 테마 커스텀 메뉴. */
export function ActionSheet({ visible, onClose, items, title }: Props) {
  const insets = useSafeAreaInsets();

  // 시트가 닫힌 뒤 액션 실행 — 다른 모달(삭제 다이얼로그 등)과 충돌 방지
  const handlePress = (fn: () => void) => {
    onClose();
    setTimeout(fn, 220);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]} onPress={() => {}}>
          <View style={styles.handle} />
          {title && (
            <AppText preset="caption" color={colors.text.tertiary} style={styles.title}>{title}</AppText>
          )}
          {items.map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handlePress(item.onPress)}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={item.destructive ? colors.feedback.danger : colors.text.secondary}
              />
              <AppText preset="bodyLarge" color={item.destructive ? colors.feedback.danger : colors.text.primary}>
                {item.label}
              </AppText>
            </Pressable>
          ))}
          <Pressable style={[styles.row, styles.cancel]} onPress={onClose}>
            <AppText preset="button" color={colors.text.secondary}>취소</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.surface.overlayScrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface.paperRaised,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.border.card, marginBottom: spacing.sm,
  },
  title: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.surface.sunken, borderRadius: radius.md },
  cancel: { justifyContent: 'center', marginTop: spacing.xs },
});
