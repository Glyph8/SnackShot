import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, CollapsibleSection } from '@/components/ui';
import { colors, spacing } from '@/theme';

// settings.tsx에서 사용하는 영상 백업 섹션 — 순수 프레젠테이션.
// 상태·핸들러는 부모(SettingsScreen)가 props로 주입한다.

export interface VideoBackupSectionProps {
  folderName: string | null;   // 선택된 백업 폴더 이름(null=미설정)
  connecting: boolean;
  autoPurge: boolean;
  onPickFolder(): void;
  onClearFolder(): void;
  onAutoPurgeToggle(v: boolean): void;
}

export function VideoBackupSection({
  folderName, connecting, autoPurge, onPickFolder, onClearFolder, onAutoPurgeToggle,
}: VideoBackupSectionProps) {
  const isSet = folderName !== null;

  return (
    <CollapsibleSection title="영상 백업" hint={isSet ? folderName : '미설정'}>
      {!isSet ? (
        <View style={styles.card}>
          <AppText preset="bodyMedium" color={colors.text.secondary}>
            백업 폴더를 선택하면 원본 영상을 월별 폴더(SnackShot-Backup/YYYY-MM)로 복사합니다. 그 폴더를 외부 저장장치로 옮겨 보관하세요.
          </AppText>
          <Button
            label={connecting ? '선택 중…' : '백업 폴더 선택'}
            onPress={onPickFolder}
            disabled={connecting}
            fullWidth
          />
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.folderInfo}>
              <AppText preset="caption" color={colors.text.secondary}>백업 폴더</AppText>
              <AppText preset="bodyLarge" numberOfLines={1}>{folderName}</AppText>
            </View>
            <Button label="해제" variant="secondary" size="sm" onPress={onClearFolder} />
          </View>

          <View style={[styles.row, styles.toggleRow]}>
            <View style={styles.toggleLabel}>
              <AppText preset="bodyLarge">백업 후 원본 자동 삭제</AppText>
              <AppText preset="caption" color={colors.text.tertiary}>
                최종 단계(L3)까지 압축된 영상만, 백업 검증 후 로컬 원본을 삭제합니다. 기본은 꺼짐.
              </AppText>
            </View>
            <Switch
              value={autoPurge}
              onValueChange={onAutoPurgeToggle}
              trackColor={{ false: colors.border.card, true: colors.brand.primary }}
              thumbColor={colors.surface.paperRaised}
            />
          </View>
        </View>
      )}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRow: { paddingTop: spacing.xs },
  toggleLabel: { flex: 1, marginRight: spacing.md },
  folderInfo: { flex: 1, marginRight: spacing.md },
});
