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
  const [showHelp, setShowHelp] = useState(false);

  function reset() {
    setDeleteFiles(false);
    setDeleteFromVault(false);
    setShowHelp(false);
  }
  function handleConfirm() {
    onConfirm({ deleteFiles, deleteFromVault });
    reset();
  }
  function handleCancel() {
    reset();
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={styles.dialog} onPress={() => { /* prevent bubble */ }}>
          {/* 제목 + 도움말 토글 */}
          <View style={styles.titleRow}>
            <AppText preset="titleMedium" style={styles.titleText}>클립 삭제</AppText>
            <Pressable onPress={() => setShowHelp((v) => !v)} hitSlop={spacing.sm}>
              <Ionicons
                name={showHelp ? 'help-circle' : 'help-circle-outline'}
                size={iconSize.lg}
                color={showHelp ? colors.brand.primary : colors.text.tertiary}
              />
            </Pressable>
          </View>
          <AppText preset="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
            삭제 후 복구할 수 없습니다.
          </AppText>

          {showHelp && (
            <View style={styles.helpBox}>
              <AppText preset="caption" color={colors.text.secondary}>
                기본 동작: 이 클립의 기록(메모·트랜스크립트·결정)을 삭제합니다.
              </AppText>
            </View>
          )}

          <View style={styles.options}>
            <Pressable style={styles.optionRow} onPress={() => setDeleteFiles((v) => !v)}>
              <View style={[styles.checkbox, deleteFiles && styles.checkboxOn]}>
                {deleteFiles && <Ionicons name="checkmark" size={iconSize.sm} color={colors.brand.onPrimary} />}
              </View>
              <AppText preset="bodyMedium">로컬 영상 파일도 삭제</AppText>
            </Pressable>
            {showHelp && (
              <AppText preset="caption" color={colors.text.tertiary} style={styles.optionHelp}>
                켜면 기기에 저장된 원본·압축 영상/오디오 파일까지 함께 지웁니다. 끄면 파일은 남고 기록만 삭제됩니다.
              </AppText>
            )}

            {vaultConnected && (
              <>
                <Pressable style={styles.optionRow} onPress={() => setDeleteFromVault((v) => !v)}>
                  <View style={[styles.checkbox, deleteFromVault && styles.checkboxOn]}>
                    {deleteFromVault && <Ionicons name="checkmark" size={iconSize.sm} color={colors.brand.onPrimary} />}
                  </View>
                  <AppText preset="bodyMedium">옵시디언에서도 삭제</AppText>
                </Pressable>
                {showHelp && (
                  <AppText preset="caption" color={colors.text.tertiary} style={styles.optionHelp}>
                    켜면 연결된 옵시디언 vault의 해당 클립 미디어와 데일리 노트 항목도 정리합니다.
                  </AppText>
                )}
              </>
            )}
          </View>

          {showHelp && (
            <AppText preset="caption" color={colors.text.tertiary}>
              삭제: 위 설정대로 삭제 · 취소: 아무것도 삭제하지 않고 닫기
            </AppText>
          )}

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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleText: { flex: 1 },
  subtitle: { marginTop: -spacing.md },

  helpBox: {
    backgroundColor: colors.surface.sunken, borderRadius: radius.md, padding: spacing.md,
  },

  options: { gap: spacing.md },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionHelp: { marginLeft: 36, marginTop: -spacing.xs },
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
