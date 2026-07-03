import { StyleSheet, Switch, View } from 'react-native';

import { AppText, CollapsibleSection } from '@/components/ui';
import { colors, spacing } from '@/theme';

// settings.tsx에서 사용하는 후속 확인 알림 섹션 — 순수 프레젠테이션(D3-b).
// 상태·핸들러는 부모(SettingsScreen)가 props로 주입한다.

export interface NotificationSectionProps {
  enabled: boolean;
  onToggle(v: boolean): void;
}

export function NotificationSection({ enabled, onToggle }: NotificationSectionProps) {
  return (
    <CollapsibleSection title="후속 확인 알림" hint={enabled ? '켜짐' : '꺼짐'}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.label}>
            <AppText preset="bodyLarge">후속 확인 시각에 알림</AppText>
            <AppText preset="caption" color={colors.text.tertiary}>
              결정에 후속 확인 날짜를 정해두면 그 시각에 로컬 알림을 보냅니다. 최초로 켤 때 알림 권한을 요청합니다.
            </AppText>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.border.card, true: colors.brand.primary }}
            thumbColor={colors.surface.paperRaised}
          />
        </View>
      </View>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flex: 1, marginRight: spacing.md },
});
