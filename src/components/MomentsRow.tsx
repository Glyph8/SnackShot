import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Dimensions, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Polaroid } from '@/components/ui';
import type { EntryWithTranscript } from '@/stores/archive';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

const GRID_COLS = 3;
const GRID_ITEM_W =
  (Dimensions.get('window').width - layout.screenPaddingX * 2 - spacing.md * (GRID_COLS - 1)) / GRID_COLS;

interface Props {
  items: EntryWithTranscript[];
  onPressItem(entryId: string): void;
  /** strip = 가로 스크롤(축약), grid = 3열 그리드(확대) */
  mode?: 'strip' | 'grid';
  /** grid 하단 여백(탭바 회피) */
  bottomInset?: number;
}

function MomentThumb({ entry }: { entry: EntryWithTranscript['entry'] }) {
  const isAudio = entry.mode === 'audio';
  const isText = entry.mode === 'text';
  return (
    <Polaroid
      tilt={0}
      aspectRatio={1}
      duration={isText ? undefined : entry.durationMs}
      caption={format(new Date(entry.recordedAt), 'a h:mm', { locale: ko })}
      typeIcon={
        <View style={styles.typeChip}>
          <Ionicons name={isText ? 'create-outline' : isAudio ? 'mic' : 'videocam'} size={iconSize.sm} color={colors.text.onMedia} />
        </View>
      }
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isAudio ? colors.media.thumbNavy : colors.media.thumbSlate }]}>
        {entry.thumbnailPath && !isAudio && !isText && (
          <Image source={{ uri: entry.thumbnailPath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </View>
    </Polaroid>
  );
}

/** 선택한 날의 클립을 가로 스트립 또는 3열 그리드로 보여준다. */
export function MomentsRow({ items, onPressItem, mode = 'strip', bottomInset = 0 }: Props) {
  if (mode === 'grid') {
    return (
      <FlatList
        data={items}
        keyExtractor={(it) => it.entry.id}
        numColumns={GRID_COLS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.gridContent, { paddingBottom: bottomInset + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPressItem(item.entry.id)} style={{ width: GRID_ITEM_W }}>
            <MomentThumb entry={item.entry} />
          </Pressable>
        )}
      />
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
      {items.map(({ entry }) => (
        <Pressable key={entry.id} onPress={() => onPressItem(entry.id)} style={styles.stripItem}>
          <MomentThumb entry={entry} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stripContent: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.md },
  stripItem: { width: 128 },
  gridRow: { gap: spacing.md },
  gridContent: { gap: spacing.md, paddingTop: spacing.xs },
  typeChip: { backgroundColor: colors.media.durationPillBg, borderRadius: radius.sm, padding: spacing.xs },
});
