import { StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppText, CollapsibleSection } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

// settings.tsx의 자동 영상 관리 섹션 — 순수 프레젠테이션.
// 개월 값은 문자열로 제어(편집 중 빈 값 허용). 상태·저장은 부모가 담당한다.

export type AutoManageField = 'l2' | 'l3' | 'backup';

export interface VideoAutoManageSectionProps {
  enabled: boolean;
  l2Months: string;
  l3Months: string;
  backupMonths: string;
  onToggle(v: boolean): void;
  onChangeMonths(field: AutoManageField, value: string): void;
}

export function VideoAutoManageSection({
  enabled, l2Months, l3Months, backupMonths, onToggle, onChangeMonths,
}: VideoAutoManageSectionProps) {
  return (
    <CollapsibleSection title="자동 영상 관리" hint={enabled ? '켜짐' : '꺼짐'}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.label}>
            <AppText preset="bodyLarge">자동 관리</AppText>
            <AppText preset="caption" color={colors.text.tertiary}>
              오래된 영상을 단계별로 자동 압축하고 백업합니다.
            </AppText>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.border.card, true: colors.brand.primary }}
            thumbColor={colors.surface.paperRaised}
          />
        </View>

        {enabled && (
          <View style={styles.thresholds}>
            <MonthRow label="2단계 압축" suffix="개월 후" value={l2Months} onChange={(v) => onChangeMonths('l2', v)} />
            <MonthRow label="3단계 압축" suffix="개월 후" value={l3Months} onChange={(v) => onChangeMonths('l3', v)} />
            <MonthRow label="원본 백업" suffix="개월 후" value={backupMonths} onChange={(v) => onChangeMonths('backup', v)} />
            <AppText preset="caption" color={colors.text.tertiary}>
              백업은 설정된 백업 폴더가 있을 때만 실행됩니다. 앱을 열 때 점검합니다.
            </AppText>
          </View>
        )}
      </View>
    </CollapsibleSection>
  );
}

function MonthRow(
  { label, suffix, value, onChange }:
  { label: string; suffix: string; value: string; onChange(v: string): void },
) {
  return (
    <View style={styles.monthRow}>
      <AppText preset="bodyMedium" style={styles.monthLabel}>{label}</AppText>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={3}
        placeholderTextColor={colors.text.tertiary}
      />
      <AppText preset="bodySmall" color={colors.text.secondary}>{suffix}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flex: 1, marginRight: spacing.md },
  thresholds: { gap: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  monthLabel: { flex: 1 },
  input: {
    width: 64, textAlign: 'center',
    borderWidth: 1, borderColor: colors.border.card, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    fontSize: 15, color: colors.text.primary, backgroundColor: colors.surface.sunken,
  },
});
