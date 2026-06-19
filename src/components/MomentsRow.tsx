import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Dimensions, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Polaroid, Tag } from '@/components/ui';
import type { EntryWithTranscript } from '@/stores/archive';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

const GRID_COLS = 3;
const GRID_ITEM_W =
  (Dimensions.get('window').width - layout.screenPaddingX * 2 - spacing.md * (GRID_COLS - 1)) / GRID_COLS;

interface Props {
  items: EntryWithTranscript[];
  onPressItem(item: EntryWithTranscript): void;
  /** strip = 가로 스크롤(축약), grid = 3열 그리드(확대) */
  mode?: 'strip' | 'grid';
  /** grid 하단 여백(탭바 회피) */
  bottomInset?: number;
}

// 텍스트 엔트리(메모/의사결정)의 앞부분 텍스트를 추출.
function leadingText(item: EntryWithTranscript): string {
  const note = item.entry.manualNote?.trim();
  if (note) return note;
  if (item.decision) return item.decision.userSummary ?? item.decision.summary;
  return '내용 없음';
}

function MomentThumb({ entry }: { entry: EntryWithTranscript['entry'] }) {
  const isAudio = entry.mode === 'audio';
  return (
    <Polaroid
      tilt={0}
      aspectRatio={1}
      duration={entry.durationMs}
      caption={format(new Date(entry.recordedAt), 'a h:mm', { locale: ko })}
      typeIcon={
        <View style={styles.typeChip}>
          <Ionicons name={isAudio ? 'mic' : 'videocam'} size={iconSize.sm} color={colors.text.onMedia} />
        </View>
      }
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isAudio ? colors.media.thumbNavy : colors.media.thumbSlate }]}>
        {entry.thumbnailPath && !isAudio && (
          <Image source={{ uri: entry.thumbnailPath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </View>
    </Polaroid>
  );
}

// 텍스트 엔트리: 썸네일 대신 앞부분 텍스트 카드. 의사결정/메모를 태그로 구분.
function MomentText({ item, lines }: { item: EntryWithTranscript; lines: number }) {
  const isDecision = !!item.decision;
  return (
    <View style={styles.textCard}>
      <View style={styles.textHead}>
        <Tag
          label={isDecision ? '의사결정' : '메모'}
          bg={isDecision ? colors.brand.tint : colors.surface.sunken}
          color={isDecision ? colors.brand.primary : colors.text.secondary}
        />
      </View>
      <AppText preset="bodySmall" numberOfLines={lines} style={styles.textBody}>
        {leadingText(item)}
      </AppText>
      <AppText preset="caption" color={colors.text.tertiary}>
        {format(new Date(item.entry.recordedAt), 'a h:mm', { locale: ko })}
      </AppText>
    </View>
  );
}

function MomentTile({ item, lines }: { item: EntryWithTranscript; lines: number }) {
  return item.entry.mode === 'text'
    ? <MomentText item={item} lines={lines} />
    : <MomentThumb entry={item.entry} />;
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
          <Pressable onPress={() => onPressItem(item)} style={{ width: GRID_ITEM_W }}>
            <MomentTile item={item} lines={5} />
          </Pressable>
        )}
      />
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
      {items.map((item) => (
        <Pressable key={item.entry.id} onPress={() => onPressItem(item)} style={styles.stripItem}>
          <MomentTile item={item} lines={4} />
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
  textCard: {
    aspectRatio: 1,
    backgroundColor: colors.surface.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: spacing.sm,
    gap: spacing.xs,
    justifyContent: 'flex-start',
  },
  textHead: { flexDirection: 'row' },
  textBody: { flex: 1 },
});
