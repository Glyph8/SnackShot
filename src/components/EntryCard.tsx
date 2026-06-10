import { format } from 'date-fns';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Entry, Transcript } from '@/types/domain';

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function firstLine(t: Transcript | null): string | null {
  const text = t?.editedText ?? t?.rawText;
  return text?.split('\n')[0].trim().slice(0, 120) ?? null;
}

interface Props {
  entry: Entry;
  transcript: Transcript | null;
  onPress?: () => void;
}

export function EntryCard({ entry, transcript, onPress }: Props) {
  const compressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';
  const sttActive =
    entry.aiLabelStatus === 'pending' || entry.aiLabelStatus === 'processing';
  const preview = firstLine(transcript);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* 썸네일 */}
      <View style={styles.thumb}>
        {entry.thumbnailPath ? (
          <Image
            source={{ uri: entry.thumbnailPath }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.thumbIcon}>{compressing ? '⏳' : '🎬'}</Text>
        )}
        {compressing && (
          <View style={styles.thumbOverlay}>
            <Text style={styles.thumbOverlayTxt}>압축 중</Text>
          </View>
        )}
      </View>

      {/* 본문 */}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{format(new Date(entry.recordedAt), 'HH:mm')}</Text>
          <Text style={styles.sep}>·</Text>
          <Text style={styles.dur}>{fmtDuration(entry.durationMs)}</Text>
          {entry.mode === 'silent' && <Text style={styles.silentTag}>조용</Text>}
        </View>

        {sttActive ? (
          <Text style={styles.analyzing}>분석 중…</Text>
        ) : preview ? (
          <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
        ) : entry.mode === 'voice' ? (
          <Text style={styles.noText}>트랜스크립트 없음</Text>
        ) : null}

        {(compressing || sttActive) && (
          <View style={styles.badgeRow}>
            {compressing && <Text style={styles.badge}>압축 중</Text>}
            {sttActive && <Text style={styles.badge}>STT 처리 중</Text>}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const THUMB = 76;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ebebeb',
  },
  pressed: { backgroundColor: '#f7f7f7' },

  thumb: {
    width: THUMB, height: THUMB, borderRadius: 8,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  thumbIcon: { fontSize: 28 },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbOverlayTxt: { fontSize: 10, color: '#fff', fontWeight: '700' },

  body: { flex: 1, justifyContent: 'center', gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  time: { fontSize: 14, fontWeight: '600', color: '#111' },
  sep: { color: '#ccc' },
  dur: { fontSize: 13, color: '#888' },
  silentTag: {
    fontSize: 10, color: '#666', fontWeight: '600',
    backgroundColor: '#efefef', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },

  analyzing: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  preview: { fontSize: 13, color: '#444', lineHeight: 18 },
  noText: { fontSize: 13, color: '#bbb' },

  badgeRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  badge: {
    fontSize: 10, color: '#b45309', fontWeight: '600',
    backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
});
