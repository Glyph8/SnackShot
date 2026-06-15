import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';

interface DeleteOptions {
  deleteFiles: boolean;
  deleteFromVault: boolean;
}

interface Props {
  visible: boolean;
  vaultConnected: boolean;
  onCancel(): void;
  onConfirm(opts: DeleteOptions): void;
}

export function DeleteEntryDialog({ visible, vaultConnected, onCancel, onConfirm }: Props) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleteFromVault, setDeleteFromVault] = useState(false);

  function handleConfirm() {
    onConfirm({ deleteFiles, deleteFromVault });
    setDeleteFiles(false);
    setDeleteFromVault(false);
  }

  function handleCancel() {
    setDeleteFiles(false);
    setDeleteFromVault(false);
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={styles.dialog} onPress={() => { /* prevent bubble */ }}>
          <AppText preset="titleMedium">클립 삭제</AppText>
          <AppText preset="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
            삭제 후 복구할 수 없습니다.
          </AppText>

          <View style={styles.options}>
            <Pressable style={styles.optionRow} onPress={() => setDeleteFiles((v) => !v)}>
              <View style={[styles.checkbox, deleteFiles && styles.checkboxOn]}>
                {deleteFiles && <Ionicons name="checkmark" size={iconSize.sm} color={colors.brand.onPrimary} />}
              </View>
              <AppText preset="bodyMedium">로컬 영상 파일도 삭제</AppText>
            </Pressable>

            {vaultConnected && (
              <Pressable style={styles.optionRow} onPress={() => setDeleteFromVault((v) => !v)}>
                <View style={[styles.checkbox, deleteFromVault && styles.checkboxOn]}>
                  {deleteFromVault && <Ionicons name="checkmark" size={iconSize.sm} color={colors.brand.onPrimary} />}
                </View>
                <AppText preset="bodyMedium">옵시디언에서도 삭제</AppText>
              </Pressable>
            )}
          </View>

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
              <AppText preset="button" color={colors.text.secondary}>취소</AppText>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnDelete]} onPress={handleConfirm}>
              <AppText preset="button" color={colors.brand.onPrimary}>삭제</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: colors.surface.overlayScrim,
    alignItems: 'center', justifyContent: 'center',
  },
  dialog: {
    backgroundColor: colors.surface.paperRaised, borderRadius: radius.xl,
    padding: spacing['2xl'], width: 300, gap: spacing.lg,
  },
  subtitle: { marginTop: -spacing.sm },

  options: { gap: spacing.md },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkbox: {
    width: 24, height: 24, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border.card,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },

  buttons: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.xs },
  btn: {
    flex: 1, borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancel: { backgroundColor: colors.surface.sunken },
  btnDelete: { backgroundColor: colors.feedback.danger },
});
