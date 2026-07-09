import { StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppText, Button, CollapsibleSection } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

// 설정 프로필 섹션 — AI가 참고하는 SnackShot/Profile.md를 앱에서 편집한다. E3 후속.
// 순수 프레젠테이션. 상태·핸들러는 부모(SettingsScreen)가 props로 주입한다.
//   - 저장: 편집기 내용 → Profile.md 덮어쓰기.
//   - 불러오기: 기존 Profile.md 내용 → 편집기 덮어쓰기.

export interface ProfileSectionProps {
  isConnected: boolean;
  value: string;
  onChangeText(v: string): void;
  onSave(): void;
  onLoad(): void;
  saving: boolean;
  loading: boolean;
  maxChars: number;
  aiEnabled: boolean;
  onToggleAiEnabled(v: boolean): void;
}

export function ProfileSection({
  isConnected, value, onChangeText, onSave, onLoad, saving, loading, maxChars,
  aiEnabled, onToggleAiEnabled,
}: ProfileSectionProps) {
  const hint = !isConnected ? '옵시디언 필요' : value.trim() ? '작성됨' : '비어 있음';

  return (
    <CollapsibleSection title="내 프로필 (AI 참고)" hint={hint}>
      {!isConnected ? (
        <View style={styles.card}>
          <AppText preset="bodyMedium" color={colors.text.secondary}>
            옵시디언 볼트를 연결하면 프로필을 저장할 수 있어요. 프로필은 볼트의 SnackShot/Profile.md에 보관됩니다.
          </AppText>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText preset="bodyLarge">AI에 프로필 전달</AppText>
              <AppText preset="caption" color={colors.text.tertiary}>
                끄면 결정 추출·작성·재작성에 프로필을 보내지 않아요
              </AppText>
            </View>
            <Switch
              value={aiEnabled}
              onValueChange={onToggleAiEnabled}
              trackColor={{ false: colors.border.card, true: colors.brand.primary }}
              thumbColor={colors.surface.paperRaised}
            />
          </View>

          <AppText preset="bodyMedium" color={colors.text.secondary}>
            직업, 관심 분야, 투자 성향, 최근 목표 등 나를 설명하는 짧은 메모. 결정 추출·작성 시 AI가 참고합니다.
          </AppText>

          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder="예: 30대 개발자. 장기 투자 선호. 올해 목표는 사이드 프로젝트 출시."
            placeholderTextColor={colors.text.tertiary}
            multiline
            textAlignVertical="top"
            maxLength={maxChars}
            editable={!saving && !loading}
          />

          <View style={styles.metaRow}>
            <AppText preset="caption" color={colors.feedback.warning}>
              ⚠ 저장 시 Gemini API로 전송됩니다
            </AppText>
            <AppText preset="caption" color={colors.text.tertiary}>
              {value.length} / {maxChars}
            </AppText>
          </View>

          <View style={styles.actions}>
            <Button
              label={loading ? '불러오는 중…' : '불러오기'}
              variant="secondary"
              onPress={onLoad}
              disabled={saving || loading}
              style={styles.btnFlex}
            />
            <Button
              label={saving ? '저장 중…' : '저장'}
              onPress={onSave}
              disabled={saving || loading}
              style={styles.btnFlex}
            />
          </View>

          <AppText preset="caption" color={colors.text.tertiary}>
            불러오기: 옵시디언에서 직접 고친 Profile.md 내용을 편집기로 덮어씁니다.
          </AppText>
        </View>
      )}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleText: { flex: 1, marginRight: spacing.md },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: colors.surface.paperRaised,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btnFlex: { flex: 1 },
});
