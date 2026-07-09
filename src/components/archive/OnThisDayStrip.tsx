import { format } from 'date-fns';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName, Pin, Tape } from '@/components/ui';
import { colors, iconSize, radius, shadow, spacing } from '@/theme';
import type { Entry, EntryMode } from '@/types/domain';

// 작년 오늘(같은 월-일 과거) 회상 스트립 — 아카이브 상단. 비면 렌더 안 함.
const MODE_ICON: Record<EntryMode, IconName> = {
  voice: 'video',
  silent: 'video',
  audio: 'audio',
  text: 'doc',
  photo: 'photo',
};

interface Props {
  items: Entry[];
  onPress(entry: Entry): void;
}

export function OnThisDayStrip({ items, onPress }: Props) {
  if (items.length === 0) return null;
  const nowYear = new Date().getFullYear();

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pin size={20} vary="on-this-day" />
        <AppText preset="titleMedium">이날의 기억</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((e, idx) => {
          const yearsAgo = nowYear - new Date(e.recordedAt).getFullYear();
          const tilt = idx % 2 === 0 ? -2 : 2;
          return (
            <Pressable key={e.id} style={[styles.card, { transform: [{ rotate: `${tilt}deg` }] }]} onPress={() => onPress(e)}>
              <View style={styles.tape} pointerEvents="none">
                <Tape width={38} height={14} angle={-8} vary={e.id} />
              </View>
              <View style={styles.thumb}>
                <Icon name={MODE_ICON[e.mode]} active size={iconSize.lg} color={colors.text.onMedia} />
              </View>
              <AppText preset="caption" color={colors.text.secondary}>
                {yearsAgo > 0 ? `${yearsAgo}년 전` : '올해'}
              </AppText>
              <AppText preset="caption" color={colors.text.tertiary}>
                {format(new Date(e.recordedAt), 'yyyy')}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  row: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs, paddingRight: spacing.md },
  card: {
    width: 84, alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface.paperRaised, borderRadius: radius.md,
    padding: spacing.sm, ...shadow.card,
  },
  tape: { position: 'absolute', top: -spacing.xs, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  thumb: {
    width: 64, height: 64, borderRadius: radius.sm,
    backgroundColor: colors.media.thumbSlate,
    alignItems: 'center', justifyContent: 'center',
  },
});
