import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Tag } from '@/components/ui';
import { colors, iconSize, spacing } from '@/theme';
import type { Entry } from '@/types/domain';

const MODE_LABEL: Record<string, string> = {
  voice: '독백', silent: '조용', audio: '녹음',
};
const LEVEL_LABEL: Record<number, string> = {
  0: '원본', 1: 'L1', 2: 'L2', 3: 'L3',
};

// 용량 관리 화면의 한 행 — 선택 토글 + 단계/백업 상태 표시. 순수 프레젠테이션.
export function StorageEntryRow(
  { entry, selected, onToggle }:
  { entry: Entry; selected: boolean; onToggle(): void },
) {
  const level = entry.compressionLevel ?? 0;
  const backupLabel = entry.originalPurgedAt != null
    ? '원본 정리됨'
    : entry.originalBackedUpAt != null
      ? '백업됨'
      : null;

  return (
    <Pressable onPress={onToggle}>
      <Card style={[styles.card, selected && styles.cardSelected]}>
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={iconSize.lg}
          color={selected ? colors.brand.primary : colors.text.tertiary}
        />
        <View style={styles.body}>
          <AppText preset="bodyMedium" numberOfLines={1}>
            {format(new Date(entry.recordedAt), 'yyyy.M.d HH:mm', { locale: ko })}
          </AppText>
          <View style={styles.tags}>
            <Tag label={MODE_LABEL[entry.mode] ?? entry.mode} bg={colors.surface.sunken} color={colors.text.secondary} />
            <Tag label={LEVEL_LABEL[level] ?? '원본'} bg={colors.surface.sunken} color={colors.text.secondary} />
            {backupLabel && (
              <Tag label={backupLabel} bg={colors.feedback.successTrack} color={colors.feedback.success} />
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cardSelected: { borderColor: colors.brand.primary, borderWidth: 1 },
  body: { flex: 1, gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
