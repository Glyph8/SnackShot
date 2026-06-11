import { format } from 'date-fns';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Entry, Transcript } from '@/types/domain';

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function transcriptBody(t: Transcript | null): string | null {
  const text = t?.editedText ?? t?.rawText;
  return text?.trim() ?? null;
}

interface Props {
  entry: Entry;
  transcript: Transcript | null;
  onPress?: () => void;
}

export function EntryDiaryItem({ entry, transcript, onPress }: Props) {
  const compressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';
  const isAudio = entry.mode === 'audio';
  const sttActive =
    entry.sttStatus === 'pending' || entry.sttStatus === 'processing';

  const body = transcriptBody(transcript);

  // ── 오디오 말머리 레이아웃 ──────────────────────────────────────────────────
  if (isAudio) {
    return (
      <Pressable
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        onPress={onPress}
      >
        {/* 말머리 재생 버튼 + 본문 인라인 */}
        <View style={styles.audioRow}>
          <Pressable style={styles.audioBullet} onPress={onPress} hitSlop={6}>
            <Text style={styles.audioBulletIcon}>▶</Text>
          </Pressable>
          <View style={styles.audioContent}>
            {body ? (
              <Text style={styles.bodyText}>{body}</Text>
            ) : sttActive ? (
              <Text style={styles.muted}>음성을 텍스트로 변환 중…</Text>
            ) : (
              <Text style={styles.muted}>
                {entry.sttStatus === 'failed' ? 'STT 실패' : '트랜스크립트 없음'}
              </Text>
            )}
          </View>
        </View>

        {/* 메타 행 */}
        <View style={styles.audioMetaRow}>
          <Text style={styles.audioTime}>{format(new Date(entry.recordedAt), 'HH:mm')}</Text>
          <Text style={styles.metaSep}>·</Text>
          <Text style={styles.duration}>{fmtDuration(entry.durationMs)}</Text>
          {sttActive && (
            <Text style={[styles.tag, styles.tagWarn]}>분석 중…</Text>
          )}
          {entry.sttStatus === 'failed' && (
            <Text style={[styles.tag, styles.tagErr]}>STT 실패</Text>
          )}
        </View>

        <View style={styles.divider} />
      </Pressable>
    );
  }

  // ── 영상 레이아웃 ──────────────────────────────────────────────────────────
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* 썸네일 — shadow wrapper + clip wrapper 분리, 너비 68% */}
      <View style={styles.thumbShadow}>
        <View style={styles.thumbClip}>
          {entry.thumbnailPath ? (
            <Image
              source={{ uri: entry.thumbnailPath }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbPlaceholderIcon}>{compressing ? '⏳' : '▶'}</Text>
            </View>
          )}

          {compressing && (
            <View style={styles.overlay}>
              <Text style={styles.overlayTxt}>압축 중…</Text>
            </View>
          )}

          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeTxt}>
              {format(new Date(entry.recordedAt), 'HH:mm')}
            </Text>
          </View>
        </View>
      </View>

      {/* 메타 행 */}
      <View style={styles.metaRow}>
        <Text style={styles.duration}>{fmtDuration(entry.durationMs)}</Text>
        {entry.mode === 'silent' && (
          <Text style={styles.tag}>조용 모드</Text>
        )}
        {sttActive && !compressing && (
          <Text style={[styles.tag, styles.tagWarn]}>분석 중…</Text>
        )}
        {entry.sttStatus === 'failed' && (
          <Text style={[styles.tag, styles.tagErr]}>STT 실패</Text>
        )}
      </View>

      {/* 본문 텍스트 */}
      <View style={styles.bodyWrap}>
        {body ? (
          <Text style={styles.bodyText}>{body}</Text>
        ) : sttActive ? (
          <Text style={styles.muted}>음성을 텍스트로 변환 중…</Text>
        ) : entry.mode === 'silent' && entry.manualNote ? (
          <Text style={styles.bodyText}>{entry.manualNote}</Text>
        ) : (
          <Text style={styles.muted}>
            {entry.mode === 'silent' ? '메모 없음' : '트랜스크립트 없음'}
          </Text>
        )}
      </View>

      <View style={styles.divider} />
    </Pressable>
  );
}

const THUMB_RADIUS = 10;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  pressed: { opacity: 0.88 },

  // ── 오디오 말머리 레이아웃 ───────────────────────────────────────────────
  audioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  audioBullet: {
    // 텍스트 lineHeight에 맞게 상단 정렬
    marginTop: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  audioBulletIcon: { fontSize: 9, color: '#fff' },
  audioContent: { flex: 1 },
  audioMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingBottom: 16,
  },
  audioTime: { fontSize: 12, color: '#999', fontWeight: '500' },
  metaSep: { fontSize: 11, color: '#ddd' },

  // ── 영상 썸네일 ───────────────────────────────────────────────────────────
  // shadow wrapper: overflow:visible 유지해야 그림자 표시됨
  thumbShadow: {
    width: '68%',
    borderRadius: THUMB_RADIUS,
    backgroundColor: '#111',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  // clip wrapper: overflow:hidden으로 Image/overlay를 borderRadius에 맞게 자름
  thumbClip: {
    aspectRatio: 5 / 3,
    borderRadius: THUMB_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  thumbPlaceholderIcon: { fontSize: 28, color: '#444' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTxt: { fontSize: 13, color: '#fff', fontWeight: '600' },
  timeBadge: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  timeBadgeTxt: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── 공통 메타 / 본문 ──────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  duration: { fontSize: 12, color: '#999', fontWeight: '500' },
  tag: {
    fontSize: 11,
    color: '#888',
    backgroundColor: '#f2f2f2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: '500',
    overflow: 'hidden',
  },
  tagWarn: { backgroundColor: '#fef3c7', color: '#b45309' },
  tagErr:  { backgroundColor: '#fee2e2', color: '#dc2626' },

  bodyWrap: { paddingTop: 4, paddingBottom: 20 },
  bodyText: { fontSize: 15, color: '#222', lineHeight: 24 },
  muted: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },

  // 구분선: 음수 margin으로 container padding 밖까지 확장
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: -16,
  },
});
