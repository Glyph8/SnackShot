import { format } from 'date-fns';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
  snippet?: string;    // 검색 결과용: <m>…</m> 마커로 강조 구간 표시
  showDate?: boolean;  // 검색 결과에서 날짜 행 표시
  onDelete?: (deleteFiles: boolean) => void; // 있을 때만 삭제 버튼 노출
}

// <m>강조</m> 마커를 파싱해 강조 Text를 렌더링한다.
function SnippetText({ text }: { text: string }) {
  const parts: Array<{ t: string; hl: boolean }> = [];
  let last = 0;
  const re = /<m>(.*?)<\/m>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), hl: false });
    parts.push({ t: m[1], hl: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last), hl: false });
  return (
    <Text style={styles.snippet} numberOfLines={2}>
      {parts.map((p, i) =>
        p.hl
          ? <Text key={i} style={styles.snippetHl}>{p.t}</Text>
          : <Text key={i}>{p.t}</Text>,
      )}
    </Text>
  );
}

export function EntryCard({ entry, transcript, onPress, snippet, showDate, onDelete }: Props) {
  const handleDeletePress = () => {
    Alert.alert(
      '클립 삭제',
      '원본 파일도 함께 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '기록만 삭제', onPress: () => onDelete?.(false) },
        { text: '파일 포함 삭제', style: 'destructive', onPress: () => onDelete?.(true) },
      ],
    );
  };

  const compressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';
  // snippet이 있으면 검색 결과 모드 — sttActive 표시 생략
  const sttActive =
    !snippet &&
    (entry.mode === 'voice' || entry.mode === 'audio') &&
    !transcript &&
    entry.aiLabelStatus !== 'failed';
  const preview = snippet ? null : firstLine(transcript);
  const isAudio = entry.mode === 'audio';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* 썸네일 */}
      <View style={[styles.thumb, isAudio && styles.thumbAudio]}>
        {isAudio ? (
          <Text style={styles.thumbIcon}>▶</Text>
        ) : entry.thumbnailPath ? (
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
        {showDate && (
          <Text style={styles.dateLabel}>
            {format(new Date(entry.recordedAt), 'yyyy년 M월 d일')}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.time}>{format(new Date(entry.recordedAt), 'HH:mm')}</Text>
          <Text style={styles.sep}>·</Text>
          <Text style={styles.dur}>{fmtDuration(entry.durationMs)}</Text>
          {entry.mode === 'silent' && <Text style={styles.silentTag}>조용</Text>}
          {entry.mode === 'audio' && <Text style={styles.silentTag}>녹음</Text>}
        </View>

        {snippet ? (
          <SnippetText text={snippet} />
        ) : sttActive ? (
          <Text style={styles.analyzing}>분석 중…</Text>
        ) : preview ? (
          <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
        ) : (entry.mode === 'voice' || entry.mode === 'audio') ? (
          <Text style={styles.noText}>트랜스크립트 없음</Text>
        ) : null}

        {(compressing || sttActive) && (
          <View style={styles.badgeRow}>
            {compressing && <Text style={styles.badge}>압축 중</Text>}
            {sttActive && <Text style={styles.badge}>STT 처리 중</Text>}
          </View>
        )}
      </View>

      {/* 삭제 버튼 — onDelete prop이 있을 때만 표시 */}
      {onDelete && (
        <Pressable
          onPress={handleDeletePress}
          style={styles.deleteCol}
          hitSlop={4}
        >
          <Text style={styles.deleteColTxt}>삭제</Text>
        </Pressable>
      )}
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
  thumbAudio: { backgroundColor: '#1a1a1a' },
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

  dateLabel: { fontSize: 11, color: '#999', fontWeight: '500', marginBottom: 2 },
  analyzing: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  preview: { fontSize: 13, color: '#444', lineHeight: 18 },
  noText: { fontSize: 13, color: '#bbb' },
  snippet: { fontSize: 13, color: '#555', lineHeight: 18 },
  snippetHl: { color: '#111', fontWeight: '700', backgroundColor: '#fef08a' },

  deleteCol: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginLeft: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#f0f0f0',
  },
  deleteColTxt: { fontSize: 13, color: '#ef4444', fontWeight: '500' },

  badgeRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  badge: {
    fontSize: 10, color: '#b45309', fontWeight: '600',
    backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
});
