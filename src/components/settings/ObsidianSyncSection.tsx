import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, CollapsibleSection } from '@/components/ui';
import type { ObsidianExportStats } from '@/db';
import { colors, radius, spacing } from '@/theme';

// settings.tsx에서 분리 (P3). 옵시디언 연동 섹션 — 순수 프레젠테이션.
// 상태·핸들러는 부모(SettingsScreen)가 props로 주입한다.

function fmtLastExport(ms: number | null): string {
  if (!ms) return '아직 내보내지 않음';
  return formatDistanceToNow(new Date(ms), { addSuffix: true, locale: ko });
}

export interface ObsidianSyncSectionProps {
  isConnected: boolean;
  folderName: string | null;
  connecting: boolean;
  permissionValid: boolean;
  autoExport: boolean;
  exportStats: ObsidianExportStats;
  onConnect(): void;
  onReconnect(): void;
  onDisconnect(): void;
  onAutoExportToggle(v: boolean): void;
  onRetryFailed(): void;
  onReexportAll(): void;
}

export function ObsidianSyncSection({
  isConnected, folderName, connecting, permissionValid, autoExport, exportStats,
  onConnect, onReconnect, onDisconnect, onAutoExportToggle, onRetryFailed, onReexportAll,
}: ObsidianSyncSectionProps) {
  const hasFailures = exportStats.failedCount > 0;
  const hasPending = exportStats.pendingCount > 0;

  return (
    <CollapsibleSection title="옵시디언 연동" hint={isConnected ? (folderName ?? '연결됨') : '미연결'}>
      {!isConnected ? (
        /* 미연결 상태 */
        <View style={styles.card}>
          <AppText preset="bodyMedium" color={colors.text.secondary}>
            옵시디언 폴더를 연결하면 일기가 마크다운으로 내보내집니다.
          </AppText>
          <Button
            label={connecting ? '연결 중…' : '폴더 선택'}
            onPress={onConnect}
            disabled={connecting}
            fullWidth
          />
        </View>
      ) : (
        /* 연결됨 상태 */
        <View style={styles.card}>
          {/* 권한 만료 경고 */}
          {!permissionValid && (
            <View style={styles.warningBanner}>
              <AppText preset="bodySmall" color={colors.feedback.warning}>
                ⚠ 다시 연결이 필요합니다 — 저장소 권한이 만료되었습니다.
              </AppText>
              <Button
                label={connecting ? '연결 중…' : '다시 연결'}
                onPress={onReconnect}
                disabled={connecting}
                size="sm"
              />
            </View>
          )}

          {/* export 실패 경고 배너 */}
          {hasFailures && (
            <View style={styles.warningBanner}>
              <AppText preset="bodySmall" color={colors.feedback.warning}>
                ⚠ 내보내기 실패 {exportStats.failedCount}건이 누적되어 있습니다.
              </AppText>
              <View style={styles.bannerActions}>
                <Button label="다시 시도" onPress={onRetryFailed} size="sm" style={styles.btnFlex} />
                <Button label="다시 연결" variant="secondary" onPress={onReconnect} disabled={connecting} size="sm" style={styles.btnFlex} />
              </View>
            </View>
          )}

          {/* 연결된 폴더 */}
          <View style={styles.row}>
            <View style={styles.folderInfo}>
              <AppText preset="caption" color={colors.text.secondary}>연결된 폴더</AppText>
              <AppText preset="bodyLarge" numberOfLines={1}>{folderName}</AppText>
            </View>
            <Button label="연결 해제" variant="secondary" size="sm" onPress={onDisconnect} />
          </View>

          {/* export 상태 */}
          <View style={styles.statsRow}>
            <View>
              <AppText preset="caption" color={colors.text.secondary}>마지막 내보내기</AppText>
              <AppText preset="bodySmall" color={colors.text.secondary}>
                {fmtLastExport(exportStats.lastSuccessAt)}
              </AppText>
            </View>
            {(hasPending || hasFailures) && (
              <AppText preset="caption" color={colors.feedback.warning}>
                {hasPending ? `대기 ${exportStats.pendingCount}건` : ''}
                {hasPending && hasFailures ? ' · ' : ''}
                {hasFailures ? `실패 ${exportStats.failedCount}건` : ''}
              </AppText>
            )}
          </View>

          {/* 자동 내보내기 토글 */}
          <View style={[styles.row, styles.toggleRow]}>
            <View>
              <AppText preset="bodyLarge">자동 내보내기</AppText>
              <AppText preset="caption" color={colors.text.tertiary}>저장 즉시 마크다운 파일 생성</AppText>
            </View>
            <Switch
              value={autoExport}
              onValueChange={onAutoExportToggle}
              trackColor={{ false: colors.border.card, true: colors.brand.primary }}
              thumbColor={colors.surface.paperRaised}
            />
          </View>

          {/* 전체 다시 내보내기 */}
          <Button label="전체 다시 내보내기" variant="secondary" onPress={onReexportAll} fullWidth />
        </View>
      )}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRow: { paddingTop: spacing.xs },
  folderInfo: { flex: 1, marginRight: spacing.md },
  statsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  warningBanner: {
    backgroundColor: colors.feedback.warningTrack,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.feedback.warning,
  },
  bannerActions: { flexDirection: 'row', gap: spacing.sm },
  btnFlex: { flex: 1 },
});
