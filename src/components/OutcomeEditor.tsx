import { Icon } from '@/components/ui';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, BinderRings, Button, PaperCurl } from '@/components/ui';
import { useReducedMotion } from '@/lib/motion';
import { borderWidth, colors, iconSize, spacing, spring } from '@/theme';
import type { Decision, OutcomeResult } from '@/types/domain';

// 결과 기록 인라인 편집기 (v8 Phase 4.1) — 결정 카드 아래에서 펼쳐지는 "후기 설문지".
// 각진 종이 폼 + 잉크 테두리 + 체크박스. 바인더 고리로 위 결정과 묶고, 눌린 결정에서
// 튀어나와 내려오는(스프링) 등장 + 기울임·말림·그림자로 진짜 붙여둔 종이처럼.

const RESULTS: { value: OutcomeResult; label: string }[] = [
  { value: 'good', label: '좋았음 👍' },
  { value: 'bad', label: '아쉬움 👎' },
  { value: 'mixed', label: '반반 🤔' },
  { value: 'unclear', label: '기억 안 남' },
];

interface Props {
  decision: Decision;
  onSubmit(result: OutcomeResult, reflection?: string): void;
  /** 영상으로 회고 기록 (record 화면으로) */
  onVideo(): void;
  /** 접기 */
  onCancel(): void;
}

export function OutcomeEditor({ decision, onSubmit, onVideo, onCancel }: Props) {
  const [result, setResult] = useState<OutcomeResult | null>(null);
  const [reflection, setReflection] = useState('');
  const summary = decision.userSummary ?? decision.summary;

  // 위 결정에서 튀어나와 내려오는 등장 — 위로 숨었다가 스프링으로 떨어져 안착.
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    const anim = Animated.spring(v, { toValue: 1, ...spring.bouncy, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, v]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-34, 0] });
  const opacity = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] });

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ translateY }, { rotate: '-1.4deg' }] }]}>
      <View style={styles.form}>
        {/* 잉크 헤더 바 */}
        <View style={styles.header}>
          <AppText preset="titleMedium" color={colors.surface.paperRaised}>회고 설문지</AppText>
          <AppText preset="caption" color={colors.surface.paperRaised}>No. 01</AppText>
        </View>

        {/* 대상 결정 — 고리로 묶인 회고 대상 명시 */}
        <View style={styles.refRow}>
          <AppText preset="caption" color={colors.text.secondary}>회고 대상</AppText>
          <AppText preset="bodyMedium" color={colors.text.primary} numberOfLines={2}>{summary}</AppText>
        </View>

        <View style={styles.rule} />

        {/* 1. 결과 — 체크박스 단일 선택 */}
        <View style={styles.section}>
          <AppText preset="bodyMedium" color={colors.text.primary} style={styles.qLabel}>1. 이 결정의 결과는?</AppText>
          {RESULTS.map((r) => {
            const on = result === r.value;
            return (
              <Pressable key={r.value} style={styles.optRow} onPress={() => setResult(r.value)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on && <Icon name="check" size={iconSize.sm} color={colors.surface.paperRaised} />}
                </View>
                <AppText preset="bodyMedium" color={colors.text.primary}>{r.label}</AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rule} />

        {/* 2. 회고 — 주관식 */}
        <View style={styles.section}>
          <AppText preset="bodyMedium" color={colors.text.primary} style={styles.qLabel}>2. 회고·배운 점 (선택)</AppText>
          <TextInput
            style={styles.input}
            value={reflection}
            onChangeText={setReflection}
            placeholder="자유롭게 적어주세요"
            placeholderTextColor={colors.text.tertiary}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.rule} />

        <View style={styles.actions}>
          <Button label="취소" variant="quiet" size="sm" onPress={onCancel} />
          <Button label="영상으로 ▸" variant="secondary" size="sm" onPress={onVideo} />
          <Button
            label="제출"
            variant="stamp"
            size="sm"
            disabled={!result}
            onPress={() => result && onSubmit(result, reflection)}
            style={styles.flex1}
          />
        </View>

        {/* 바닥 모서리 말림 */}
        <PaperCurl side="right" size={34} style={styles.curl} />
      </View>

      {/* 쇠 바인더 고리 — 오른쪽 호만 보이며 위 결정 카드와 설문지를 꿰어 묶은 듯 걸친다 */}
      <BinderRings count={3} size={44} style={styles.rings} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 위 결정 카드 가까이 붙여(고리가 카드까지 걸치도록) 살짝 기울인 종이
  wrap: { marginTop: -spacing.sm, marginBottom: spacing.lg },
  // 각진 종이 폼 — 잉크 테두리 + 떠 있는 그림자
  form: {
    backgroundColor: colors.surface.paperRaised,
    borderWidth: borderWidth.thick,
    borderColor: colors.text.primary,
    shadowColor: colors.text.primary,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.text.primary,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  refRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  qLabel: { marginBottom: spacing.xs },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: {
    width: 22, height: 22,
    borderWidth: borderWidth.thick, borderColor: colors.text.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.text.primary },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.text.primary },
  input: {
    borderWidth: borderWidth.thin, borderColor: colors.text.primary,
    padding: spacing.md, fontSize: 15, color: colors.text.primary,
    minHeight: 72, textAlignVertical: 'top', backgroundColor: colors.surface.paper,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  flex1: { flex: 1 },
  curl: { position: 'absolute', right: -1, bottom: -2 },
  // 고리는 설문지(폼) 앞 레이어. 위로 솟아 카드 위까지 오른쪽 호가 걸쳐 꿰인 듯 보인다.
  rings: { position: 'absolute', top: -spacing.xl, left: spacing.xl, right: spacing.xl, height: 44, zIndex: 4 },
});
