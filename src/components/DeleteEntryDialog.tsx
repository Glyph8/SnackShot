import { useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';

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
          <Text style={styles.title}>클립 삭제</Text>
          <Text style={styles.subtitle}>삭제 후 복구할 수 없습니다.</Text>

          <View style={styles.options}>
            <Pressable style={styles.optionRow} onPress={() => setDeleteFiles((v) => !v)}>
              <View style={[styles.checkbox, deleteFiles && styles.checkboxOn]}>
                {deleteFiles && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.optionLabel}>로컬 영상 파일도 삭제</Text>
            </Pressable>

            {vaultConnected && (
              <Pressable style={styles.optionRow} onPress={() => setDeleteFromVault((v) => !v)}>
                <View style={[styles.checkbox, deleteFromVault && styles.checkboxOn]}>
                  {deleteFromVault && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.optionLabel}>옵시디언에서도 삭제</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
              <Text style={styles.btnCancelTxt}>취소</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnDelete]} onPress={handleConfirm}>
              <Text style={styles.btnDeleteTxt}>삭제</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  dialog: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 24, width: 300, gap: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 13, color: '#888', marginTop: -8 },

  options: { gap: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#ccc',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#111', borderColor: '#111' },
  checkmark: { fontSize: 13, color: '#fff', fontWeight: '700' },
  optionLabel: { fontSize: 14, color: '#333' },

  buttons: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  btn: {
    flex: 1, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancel: { backgroundColor: '#f0f0f0' },
  btnCancelTxt: { fontSize: 15, color: '#555', fontWeight: '500' },
  btnDelete: { backgroundColor: '#dc2626' },
  btnDeleteTxt: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
