import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, HandDrawnBorder, PaperTexture } from '@/components/ui';
import { TextRevisionSheet } from '@/components/revision/TextRevisionSheet';
import { addCustomCategory, getSettings } from '@/db';
import { haptics } from '@/lib/haptics';
import type { DecisionTextField } from '@/services/textRevision';
import { borderWidth, colors, radius, spacing, spring } from '@/theme';
import { DECISION_CATEGORY } from '@/types/enums';
import type { Decision, DecisionCategory } from '@/types/domain';
import type { EditParams } from '@/stores/inbox';

const CATEGORIES: { value: DecisionCategory; label: string }[] = [
  { value: 'investment', label: '투자' },
  { value: 'relationship', label: '관계' },
  { value: 'career', label: '커리어' },
  { value: 'daily', label: '일상' },
  { value: 'other', label: '기타' },
];

interface Props {
  visible: boolean;
  decision: Decision;
  onSave(edits: EditParams): void;
  onCancel(): void;
}

export function EditDecisionSheet({ visible, decision, onSave, onCancel }: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? insets.top : 0;
  const [summary, setSummary] = useState(decision.userSummary ?? decision.summary);
  const [situation, setSituation] = useState(decision.userSituation ?? decision.situation ?? '');
  // 카테고리는 빌트인 enum 값이거나 커스텀 라벨 문자열
  const [category, setCategory] = useState<string>(
    decision.customCategory && decision.customCategory.length > 0
      ? decision.customCategory
      : (decision.userCategory ?? decision.category),
  );
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');
  const [daysStr, setDaysStr] = useState(() => {
    if (!decision.followUpAt) return '';
    const remaining = Math.ceil((decision.followUpAt - Date.now()) / 86_400_000);
    return remaining > 0 ? String(remaining) : '';
  });
  const [revField, setRevField] = useState<DecisionTextField | null>(null);
  // 승인 도장 — 누르기 전엔 점선 버튼, 누르면 찍히는 연출
  const [stamped, setStamped] = useState(false);
  const stampScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await getSettings(db);
        if (mounted) setCustomCategories(s.customCategories);
      } catch (e) {
        console.warn('[edit-decision] custom categories load failed', e);
      }
    })();
    return () => { mounted = false; };
  }, [db]);

  async function handleAddCategory() {
    const label = newCat.trim();
    if (!label) return;
    try {
      const list = await addCustomCategory(db, label);
      setCustomCategories(list);
      setCategory(label);
      setNewCat('');
    } catch (e) {
      console.warn('[edit-decision] add category failed', e);
    }
  }

  function persist() {
    const edits: EditParams = {};
    const trimmed = summary.trim();
    if (trimmed) edits.userSummary = trimmed;
    if (situation.trim()) edits.userSituation = situation.trim();
    // 빌트인이면 enum 저장 + 커스텀 라벨 해제(''), 커스텀이면 enum='other' + 라벨 보존
    const isBuiltin = (DECISION_CATEGORY as readonly string[]).includes(category);
    edits.userCategory = isBuiltin ? (category as DecisionCategory) : 'other';
    edits.customCategory = isBuiltin ? '' : category;
    const days = parseInt(daysStr, 10);
    if (!isNaN(days) && days > 0) {
      edits.followUpAt = Date.now() + days * 86_400_000;
    }
    onSave(edits);
  }

  function handleApprove() {
    if (stamped) return;
    setStamped(true);
    haptics.success();
    // 도장이 '쾅' 찍혔다 안착하는 팝
    stampScale.setValue(1.3);
    Animated.spring(stampScale, { toValue: 1, ...spring.stiff, useNativeDriver: true }).start();
    setTimeout(persist, 340);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <View style={[styles.root, { paddingTop: topPad }]}>
        {/* 종이 질감 — 화면 전체에 깔아 색 통일 */}
        <PaperTexture vignette={false} />

        {/* 툴바 — 취소만(저장은 하단 '승인' 도장) */}
        <View style={styles.toolbar}>
          <Pressable onPress={onCancel} hitSlop={spacing.md}>
            <AppText preset="bodyLarge" color={colors.text.secondary}>취소</AppText>
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {/* 레터헤드 — 제목 + 이중 잉크 괘선 */}
          <View style={styles.docHead}>
            <AppText preset="cardTitle" color={colors.text.primary}>결정 수정</AppText>
            <AppText preset="caption" color={colors.text.secondary}>의사결정 검토 보고서</AppText>
          </View>
          <View style={styles.ruleThick} />
          <View style={styles.ruleThin} />

          {/* 1. 요약 */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <AppText preset="bodyMedium" color={colors.text.primary} style={styles.fieldLabel}>1. 요약</AppText>
              <Pressable onPress={() => setRevField('summary')} hitSlop={spacing.sm}>
                <AppText preset="caption" color={colors.text.link}>AI 재작성 · 기록</AppText>
              </Pressable>
            </View>
            <TextInput
              style={styles.textArea}
              value={summary}
              onChangeText={setSummary}
              multiline
              numberOfLines={3}
              placeholder="결정 내용을 입력하세요"
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          <View style={styles.sectionRule} />

          {/* 2. 상황 */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <AppText preset="bodyMedium" color={colors.text.primary} style={styles.fieldLabel}>2. 상황 (맥락)</AppText>
              <Pressable onPress={() => setRevField('situation')} hitSlop={spacing.sm}>
                <AppText preset="caption" color={colors.text.link}>AI 재작성 · 기록</AppText>
              </Pressable>
            </View>
            <TextInput
              style={styles.textArea}
              value={situation}
              onChangeText={setSituation}
              multiline
              placeholder="이 결정이 나온 상황·배경"
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          <View style={styles.sectionRule} />

          {/* 3. 카테고리 — 빌트인 + 커스텀 + 새로 추가 */}
          <View style={styles.section}>
            <AppText preset="bodyMedium" color={colors.text.primary} style={styles.fieldLabel}>3. 카테고리</AppText>
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => {
                const on = category === c.value;
                return (
                  <Pressable key={c.value} style={[styles.catBtn, on && styles.catSelected]} onPress={() => setCategory(c.value)}>
                    <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.primary}>{c.label}</AppText>
                  </Pressable>
                );
              })}
              {customCategories.map((c) => {
                const on = category === c;
                return (
                  <Pressable key={c} style={[styles.catBtn, on && styles.catSelected]} onPress={() => setCategory(c)}>
                    <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.primary}>{c}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newCat}
                onChangeText={setNewCat}
                placeholder="새 카테고리 추가"
                placeholderTextColor={colors.text.tertiary}
                onSubmitEditing={handleAddCategory}
                returnKeyType="done"
              />
              <Pressable onPress={handleAddCategory} disabled={!newCat.trim()} hitSlop={spacing.sm} style={[styles.addBtn, !newCat.trim() && styles.addBtnDisabled]}>
                <AppText preset="caption" color={colors.brand.onPrimary}>추가</AppText>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionRule} />

          {/* 4. 후속 확인 */}
          <View style={styles.section}>
            <AppText preset="bodyMedium" color={colors.text.primary} style={styles.fieldLabel}>4. 후속 확인 (N일 후)</AppText>
            <TextInput
              style={[styles.textArea, styles.inputSm]}
              value={daysStr}
              onChangeText={setDaysStr}
              keyboardType="number-pad"
              placeholder="예: 7"
              placeholderTextColor={colors.text.tertiary}
            />
            <AppText preset="caption" color={colors.text.tertiary} style={styles.hint}>
              비워두면 후속 확인을 설정하지 않습니다.
            </AppText>
          </View>

          {/* 하단 '승인' 도장 버튼 — 누르기 전 점선 버튼, 누르면 빨간 도장이 찍힌다 */}
          <View style={styles.stampRow}>
            <Pressable onPress={handleApprove} hitSlop={spacing.sm} accessibilityRole="button" accessibilityLabel="승인 · 저장">
              <Animated.View style={[styles.stamp, { transform: [{ rotate: stamped ? '-8deg' : '0deg' }, { scale: stampScale }] }]}>
                <HandDrawnBorder
                  shape="box"
                  dashed={!stamped}
                  color={stamped ? colors.accent.pin : colors.text.primary}
                  radius={radius.xs}
                  strokeWidth={stamped ? 2.6 : 1.6}
                />
                <AppText preset="cardTitle" color={stamped ? colors.accent.pin : colors.text.primary}>승인</AppText>
              </Animated.View>
            </Pressable>
            {!stamped && (
              <AppText preset="caption" color={colors.text.tertiary} style={styles.stampHint}>눌러서 저장·컨펌</AppText>
            )}
          </View>
        </ScrollView>

        {revField && (
          <TextRevisionSheet
            key={revField}
            visible
            title={revField === 'summary' ? '요약 수정 · 기록' : '상황 수정 · 기록'}
            onClose={() => setRevField(null)}
            target={{ kind: 'decision', decisionId: decision.id, field: revField }}
            aiOriginal={revField === 'summary' ? decision.summary : (decision.situation ?? '')}
            initialCurrent={revField === 'summary' ? summary : situation}
            targetLabel={revField === 'summary' ? '의사결정 요약' : '의사결정 상황'}
            onApplied={(c) => (revField === 'summary' ? setSummary(c) : setSituation(c))}
          />
        )}
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // 흰 종이 한 색으로 통일(문서 그림자·비네팅 제거)
  root: { flex: 1, backgroundColor: colors.surface.sheet },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
  },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

  docHead: { gap: spacing.xs, marginBottom: spacing.sm },
  ruleThick: { height: borderWidth.thick, backgroundColor: colors.text.primary },
  ruleThin: { height: StyleSheet.hairlineWidth, backgroundColor: colors.text.primary, marginTop: 3 },

  section: { marginTop: spacing.xl },
  sectionRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.card, marginTop: spacing.xl },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  fieldLabel: { marginBottom: spacing.sm },
  textArea: {
    borderWidth: borderWidth.thin, borderColor: colors.text.primary, borderRadius: radius.xs,
    padding: spacing.md, fontSize: 15, color: colors.text.primary,
    textAlignVertical: 'top', minHeight: 80, backgroundColor: 'transparent',
  },
  inputSm: { minHeight: 44 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  catBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.xs, borderWidth: borderWidth.thin, borderColor: colors.text.primary,
    backgroundColor: 'transparent',
  },
  catSelected: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  addInput: {
    flex: 1, borderWidth: borderWidth.thin, borderColor: colors.text.primary, borderRadius: radius.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.text.primary,
    backgroundColor: 'transparent', minHeight: 40,
  },
  addBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.xs,
    backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center', minHeight: 40,
  },
  addBtnDisabled: { opacity: 0.4 },
  hint: { marginTop: spacing.xs },

  stampRow: { alignItems: 'center', marginTop: spacing['3xl'], gap: spacing.sm },
  stamp: {
    minWidth: 132,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },
  stampHint: { },
});
