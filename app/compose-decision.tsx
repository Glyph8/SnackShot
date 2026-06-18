/** @codemap 결정 작성(/compose-decision) — 의도적 작성(수동/키워드+Gemini) → confirmed 저장
 *  데이터: services/saveAuthoredDecision · services/label(composeDecision) · 관련 ADR: 003, 006, 016
 */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { CATEGORY_LABELS } from '@/components/DecisionCardBody';
import { AppText, Button, ScreenBackground } from '@/components/ui';
import { getSettings, addCustomCategory } from '@/db';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { getLabelService } from '@/services/label';
import { saveAuthoredDecision } from '@/services/saveAuthoredDecision';
import { colors, radius, spacing } from '@/theme';
import { DECISION_CATEGORY, type DecisionCategory } from '@/types/domain';

export default function ComposeDecisionScreen() {
  const db = useSQLiteContext();
  const recordedAtRef = useRef(Date.now());

  const kbHeight = useKeyboardHeight();
  const [summary, setSummary] = useState('');
  // category는 빌트인 enum 값이거나 사용자 커스텀 라벨 문자열
  const [category, setCategory] = useState<string>('daily');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [situation, setSituation] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [followUpDays, setFollowUpDays] = useState('');
  const [filling, setFilling] = useState(false);
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // 저장된 커스텀 카테고리 로드
  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings(db);
        if (mountedRef.current) setCustomCategories(s.customCategories);
      } catch (e) {
        console.warn('[compose-decision] custom categories load failed', e);
      }
    })();
  }, [db]);

  const handleAddCategory = useCallback(async () => {
    const label = newCat.trim();
    if (!label) { setAddingCat(false); return; }
    try {
      const list = await addCustomCategory(db, label);
      if (!mountedRef.current) return;
      setCustomCategories(list);
      setCategory(label);
    } catch (e) {
      console.warn('[compose-decision] add category failed', e);
    } finally {
      if (mountedRef.current) { setNewCat(''); setAddingCat(false); }
    }
  }, [db, newCat]);

  const canSave =
    !!summary.trim() && !!situation.trim() && !!alternatives.trim() &&
    !!reasoning.trim() && !!expectedOutcome.trim() && !saving && !filling;

  const handleCancel = useCallback(() => {
    if (saving || filling) return;
    router.back();
  }, [saving, filling]);

  // 키워드/한 줄 입력 → Gemini가 상황·대안·이유·예상결과 채움 (검토·수정 후 저장)
  const handleFill = useCallback(async () => {
    const seed = summary.trim();
    if (!seed) {
      Alert.alert('입력 필요', '요약 칸에 키워드나 한 줄을 먼저 적어주세요.');
      return;
    }
    setFilling(true);
    try {
      const draft = await getLabelService().composeDecision(seed);
      if (!mountedRef.current) return;
      setSummary(draft.summary);
      setCategory(draft.category);
      setSituation(draft.situation);
      setAlternatives(draft.alternatives);
      setReasoning(draft.reasoning);
      setExpectedOutcome(draft.expectedOutcome);
      if (draft.followUpAfterDays != null) setFollowUpDays(String(draft.followUpAfterDays));
    } catch (e) {
      console.error('[compose-decision] fill failed', e);
      Alert.alert('채우기 실패', 'Gemini 키 설정을 확인하거나 잠시 후 다시 시도해 주세요.');
    } finally {
      if (mountedRef.current) setFilling(false);
    }
  }, [summary]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const days = parseInt(followUpDays, 10);
      // 커스텀 카테고리면 enum은 'other'로 저장하고 라벨은 customCategory에 보존
      const isBuiltin = (DECISION_CATEGORY as readonly string[]).includes(category);
      await saveAuthoredDecision(db, {
        recordedAt: recordedAtRef.current,
        summary: summary.trim(),
        category: isBuiltin ? (category as DecisionCategory) : 'other',
        customCategory: isBuiltin ? undefined : category,
        situation: situation.trim(),
        alternatives: alternatives.trim(),
        reasoning: reasoning.trim(),
        expectedOutcome: expectedOutcome.trim(),
        followUpAfterDays: !isNaN(days) && days > 0 ? days : null,
      });
      router.back();
    } catch (e) {
      console.error('[compose-decision] save failed', e);
      Alert.alert('저장 실패', '다시 시도해 주세요.');
      setSaving(false);
    }
  }, [canSave, db, summary, category, situation, alternatives, reasoning, expectedOutcome, followUpDays]);

  return (
    <View style={styles.root}>
      <ScreenBackground edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={handleCancel} disabled={saving || filling} hitSlop={spacing.lg}>
            <AppText preset="bodyLarge" color={colors.text.link}>취소</AppText>
          </Pressable>
          <AppText preset="titleMedium">결정 작성</AppText>
          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={spacing.lg}>
            <AppText preset="button" color={colors.text.link} style={!canSave ? styles.dimmed : undefined}>저장</AppText>
          </Pressable>
        </View>

        {/* 키보드 높이만큼만 하단 패딩 — 닫히면 0이라 잔여 여백이 남지 않는다 */}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xl + kbHeight }]}
          keyboardShouldPersistTaps="handled">
          <Field label="요약 (한 줄 또는 키워드)">
            <TextInput
              style={styles.input}
              value={summary}
              onChangeText={setSummary}
              placeholder="예: 다음 달 실적 보고 삼성전자 매수 결정"
              placeholderTextColor={colors.text.tertiary}
              editable={!saving && !filling}
            />
          </Field>

          <Button
            label={filling ? 'Gemini가 채우는 중…' : '✨ Gemini로 채우기'}
            variant="secondary"
            onPress={handleFill}
            disabled={filling || saving}
            fullWidth
          />

          <Field label="상황 (맥락·배경)">
            <MultilineInput value={situation} onChangeText={setSituation} editable={!saving && !filling} placeholder="이 결정이 나온 상황" />
          </Field>
          <Field label="대안">
            <MultilineInput value={alternatives} onChangeText={setAlternatives} editable={!saving && !filling} placeholder="고려한 다른 선택지" />
          </Field>
          <Field label="선택 이유">
            <MultilineInput value={reasoning} onChangeText={setReasoning} editable={!saving && !filling} placeholder="왜 이 선택을 했는가" />
          </Field>
          <Field label="예상 결과">
            <MultilineInput value={expectedOutcome} onChangeText={setExpectedOutcome} editable={!saving && !filling} placeholder="이 결정으로 기대하는 결과" />
          </Field>

          <Field label="카테고리">
            <View style={styles.catRow}>
              {DECISION_CATEGORY.map((c) => {
                const on = category === c;
                return (
                  <Pressable key={c} style={[styles.catBtn, on && styles.catOn]} onPress={() => setCategory(c)}>
                    <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>
                      {CATEGORY_LABELS[c] ?? c}
                    </AppText>
                  </Pressable>
                );
              })}
              {customCategories.map((c) => {
                const on = category === c;
                return (
                  <Pressable key={c} style={[styles.catBtn, on && styles.catOn]} onPress={() => setCategory(c)}>
                    <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>{c}</AppText>
                  </Pressable>
                );
              })}
              {addingCat ? (
                <View style={styles.catAddRow}>
                  <TextInput
                    style={styles.catAddInput}
                    value={newCat}
                    onChangeText={setNewCat}
                    placeholder="새 카테고리"
                    placeholderTextColor={colors.text.tertiary}
                    autoFocus
                    onSubmitEditing={handleAddCategory}
                    returnKeyType="done"
                  />
                  <Button label="추가" size="sm" onPress={handleAddCategory} disabled={!newCat.trim()} />
                </View>
              ) : (
                <Pressable style={[styles.catBtn, styles.catAddBtn]} onPress={() => setAddingCat(true)}>
                  <AppText preset="bodySmall" color={colors.brand.primary}>＋ 직접 추가</AppText>
                </Pressable>
              )}
            </View>
          </Field>

          <Field label="후속 확인 (N일 후 · 선택)">
            <TextInput
              style={styles.input}
              value={followUpDays}
              onChangeText={setFollowUpDays}
              keyboardType="number-pad"
              placeholder="예: 7 (비우면 설정 안 함)"
              placeholderTextColor={colors.text.tertiary}
              editable={!saving && !filling}
            />
          </Field>
        </ScrollView>
      </ScreenBackground>

      {saving && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.text.onMedia} />
          <AppText preset="bodyMedium" color={colors.text.onMedia}>저장 중…</AppText>
        </View>
      )}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText preset="caption" color={colors.text.secondary}>{label}</AppText>
      {children}
    </View>
  );
}

function MultilineInput(props: {
  value: string;
  onChangeText(v: string): void;
  editable: boolean;
  placeholder: string;
}) {
  return (
    <TextInput
      style={[styles.input, styles.multiline]}
      value={props.value}
      onChangeText={props.onChangeText}
      editable={props.editable}
      placeholder={props.placeholder}
      placeholderTextColor={colors.text.tertiary}
      multiline
      textAlignVertical="top"
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  dimmed: { opacity: 0.35 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  field: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    color: colors.text.primary, fontSize: 15, padding: spacing.md,
  },
  multiline: { minHeight: 72 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  catOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  catAddBtn: { borderStyle: 'dashed', borderColor: colors.brand.primary },
  catAddRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexBasis: '100%' },
  catAddInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border.card, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15, color: colors.text.primary,
    backgroundColor: colors.surface.sunken,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlayScrim,
    alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
  },
});
