import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Switch, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { TextRevision, TextRevisionSource } from '@/types/domain';

import { useTextRevision, type UseTextRevisionOpts } from './useTextRevision';

const SOURCE_LABEL: Record<TextRevisionSource, string> = {
  ai_original: 'AI 원본',
  manual: '직접 수정',
  ai_rewrite: 'AI 재작성',
  restore: '되돌림',
};

interface Props extends UseTextRevisionOpts {
  visible: boolean;
  title: string;
  onClose(): void;
}

// 전사·결정 텍스트의 수동 수정 / AI 재작성 / 버전 복원을 한 시트에서 처리 (v10).
export function TextRevisionSheet({ visible, title, onClose, ...hookOpts }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? insets.top : 0;
  const { history, current, busy, error, saveManual, rewrite, restore } = useTextRevision(hookOpts);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [instruction, setInstruction] = useState('');
  const [includeProfile, setIncludeProfile] = useState(true);

  const beginEdit = () => { setDraft(current); setEditing(true); };
  const submitEdit = async () => { await saveManual(draft.trim()); setEditing(false); };
  const submitRewrite = async () => {
    const text = instruction.trim();
    if (!text) return;
    await rewrite(text, includeProfile);
    setInstruction('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <View style={[styles.root, { paddingTop: topPad }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={spacing.md}>
              <AppText preset="bodyLarge" color={colors.text.secondary}>닫기</AppText>
            </Pressable>
            <AppText preset="titleMedium" numberOfLines={1}>{title}</AppText>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* 현재 내용 + 직접 수정 */}
            <AppText preset="caption" color={colors.text.secondary} style={styles.label}>현재 내용</AppText>
            {editing ? (
              <>
                <TextInput
                  style={styles.textArea}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  placeholder="내용을 입력하세요"
                  placeholderTextColor={colors.text.tertiary}
                />
                <View style={styles.row}>
                  <Button label="취소" variant="quiet" size="sm" onPress={() => setEditing(false)} />
                  <Button label="저장" variant="primary" size="sm" onPress={submitEdit} disabled={busy} />
                </View>
              </>
            ) : (
              <Card style={styles.currentCard}>
                <AppText preset="bodyMedium">{current || '(비어 있음)'}</AppText>
                <View style={styles.row}>
                  <Button label="직접 수정" variant="secondary" size="sm" onPress={beginEdit} disabled={busy} />
                </View>
              </Card>
            )}

            {/* AI 재작성 */}
            <AppText preset="caption" color={colors.text.secondary} style={styles.label}>AI로 다시 쓰기</AppText>
            <TextInput
              style={styles.textArea}
              value={instruction}
              onChangeText={setInstruction}
              multiline
              editable={!busy}
              placeholder="어떻게 고쳐야 하는지, 원래 의도가 무엇인지 설명하세요. 예: '삼성전자가 아니라 SK하이닉스였어. 매도가 아니라 매수 보류였고.'"
              placeholderTextColor={colors.text.tertiary}
            />
            <View style={styles.profileToggleRow}>
              <View style={styles.flex}>
                <AppText preset="caption" color={colors.text.secondary}>내 프로필 반영</AppText>
                <AppText preset="caption" color={colors.text.tertiary}>끄면 이번 재작성에만 프로필을 제외해요</AppText>
              </View>
              <Switch
                value={includeProfile}
                onValueChange={setIncludeProfile}
                disabled={busy}
                trackColor={{ false: colors.border.card, true: colors.brand.primary }}
                thumbColor={colors.surface.paperRaised}
              />
            </View>
            <View style={styles.row}>
              {busy && <ActivityIndicator color={colors.brand.primary} />}
              <Button
                label={busy ? '다시 쓰는 중…' : 'AI로 다시 쓰기'}
                variant="primary"
                size="sm"
                onPress={submitRewrite}
                disabled={busy || !instruction.trim()}
              />
            </View>
            <AppText preset="caption" color={colors.text.tertiary} style={styles.hint}>
              결과는 바로 적용됩니다. 마음에 들지 않으면 아래 기록에서 이전 버전으로 되돌리세요.
            </AppText>

            {error && (
              <AppText preset="caption" color={colors.feedback.danger} style={styles.hint}>{error}</AppText>
            )}

            {/* 버전 기록 */}
            <AppText preset="caption" color={colors.text.secondary} style={styles.label}>
              기록 {history.length > 0 ? `· ${history.length}` : ''}
            </AppText>
            {history.length === 0 ? (
              <AppText preset="caption" color={colors.text.tertiary}>
                아직 변경 기록이 없습니다. 처음 수정하면 AI 원본부터 기록됩니다.
              </AppText>
            ) : (
              history.map((rev, idx) => (
                <RevisionRow
                  key={rev.id}
                  rev={rev}
                  isCurrent={idx === 0}
                  busy={busy}
                  onRestore={() => restore(rev)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RevisionRow(
  { rev, isCurrent, busy, onRestore }:
  { rev: TextRevision; isCurrent: boolean; busy: boolean; onRestore(): void },
) {
  return (
    <Card style={styles.revCard}>
      <View style={styles.revTop}>
        <Tag label={SOURCE_LABEL[rev.source]} bg={colors.surface.sunken} color={colors.text.secondary} />
        {isCurrent
          ? <Tag label="현재" bg={colors.brand.primary} color={colors.brand.onPrimary} />
          : (
            <Pressable onPress={onRestore} disabled={busy} hitSlop={spacing.sm}>
              <AppText preset="caption" color={busy ? colors.text.tertiary : colors.text.link}>되돌리기</AppText>
            </Pressable>
          )}
      </View>
      <AppText preset="bodySmall" numberOfLines={3}>{rev.content || '(비어 있음)'}</AppText>
      {!!rev.instruction && (
        <AppText preset="caption" color={colors.text.tertiary} numberOfLines={2}>
          지침: {rev.instruction}
        </AppText>
      )}
      <AppText preset="caption" color={colors.text.tertiary}>
        {format(new Date(rev.createdAt), 'M월 d일 HH:mm', { locale: ko })}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border.hairline,
  },
  headerSpacer: { width: 32 },
  body: { padding: spacing.xl },
  label: { marginBottom: spacing.sm, marginTop: spacing.xl },
  textArea: {
    borderWidth: 1, borderColor: colors.border.card, borderRadius: radius.md,
    padding: spacing.md, fontSize: 15, color: colors.text.primary,
    textAlignVertical: 'top', minHeight: 80, backgroundColor: colors.surface.sunken,
  },
  currentCard: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  profileToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  hint: { marginTop: spacing.xs },
  revCard: { gap: spacing.xs, marginTop: spacing.sm },
  revTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
