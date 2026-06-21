import { Icon } from '@/components/ui';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Dimensions, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, LinedPaper, Pin, Polaroid, PostIt, Tag } from '@/components/ui';
import type { EntryWithTranscript } from '@/stores/archive';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

// 타일마다 살짝 다른 기울임(±) — id 끝 글자 기준
function tiltFor(id: string): number {
  return id.charCodeAt(id.length - 1) % 2 === 0 ? -2 : 2;
}

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

// 영상/음성: 압정으로 꽂은 폴라로이드(살짝 기울임).
function MomentThumb({ entry }: { entry: EntryWithTranscript['entry'] }) {
  const isAudio = entry.mode === 'audio';
  return (
    <View style={styles.thumbWrap}>
      <Pin size={16} vary={entry.id} style={styles.thumbPin} />
      <Polaroid
        tilt={tiltFor(entry.id)}
        aspectRatio={1}
        duration={entry.durationMs}
        caption={format(new Date(entry.recordedAt), 'a h:mm', { locale: ko })}
        typeIcon={
          <View style={styles.typeChip}>
            <Icon name={isAudio ? 'audio' : 'video'} size={iconSize.sm} color={colors.text.onMedia} />
          </View>
        }
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isAudio ? colors.media.thumbNavy : colors.media.thumbSlate }]}>
          {entry.thumbnailPath && !isAudio && (
            <Image source={{ uri: entry.thumbnailPath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
        </View>
      </Polaroid>
    </View>
  );
}

// 텍스트 엔트리: 의사결정=포스트잇 / 메모=가로줄 공책 조각. (일기 화면과 동일 메타포)
function MomentText({ item, lines }: { item: EntryWithTranscript; lines: number }) {
  const time = format(new Date(item.entry.recordedAt), 'a h:mm', { locale: ko });
  if (item.decision) {
    return (
      <PostIt vary={item.entry.id} padding={spacing.sm} style={styles.tile}>
        <View style={styles.textHead}>
          <Tag label="의사결정" bg={colors.brand.tint} color={colors.brand.primary} />
        </View>
        <AppText preset="bodySmall" color={colors.text.onSticky} numberOfLines={lines} style={styles.textBody}>
          {leadingText(item)}
        </AppText>
        <AppText preset="caption" color={colors.text.onStickyFaint}>{time}</AppText>
      </PostIt>
    );
  }
  return (
    <LinedPaper torn tilt={tiltFor(item.entry.id)} lineGap={22} padding={spacing.sm} style={styles.tile}>
      <View style={styles.textHead}>
        <Tag label="메모" bg={colors.surface.sunken} color={colors.text.secondary} />
      </View>
      <AppText preset="bodySmall" numberOfLines={lines} style={styles.textBody}>
        {leadingText(item)}
      </AppText>
      <AppText preset="caption" color={colors.text.tertiary}>{time}</AppText>
    </LinedPaper>
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
  thumbWrap: { paddingTop: spacing.sm },
  thumbPin: { position: 'absolute', top: 0, left: '50%', marginLeft: -8, zIndex: 3 },
  tile: { aspectRatio: 1, gap: spacing.xs, justifyContent: 'flex-start' },
  textHead: { flexDirection: 'row' },
  textBody: { flex: 1 },
});
