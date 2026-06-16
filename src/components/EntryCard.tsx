import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { DeleteEntryDialog } from '@/components/DeleteEntryDialog';
import { AppText, Card, Tag } from '@/components/ui';
import { colors, fontFamily, fontWeight, iconSize, opacity, radius, spacing } from '@/theme';
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
  vaultConnected?: boolean; // 옵시디언 연결 여부 — 삭제 모달의 vault 옵션 노출
  onDelete?: (opts: { deleteFiles: boolean; deleteFromVault: boolean }) => void; // 있을 때만 삭제 버튼 노출
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
    <AppText preset="bodySmall" color={colors.text.secondary} numberOfLines={2}>
      {parts.map((p, i) =>
        p.hl ? <Text key={i} style={styles.snippetHl}>{p.t}</Text> : <Text key={i}>{p.t}</Text>,
      )}
    </AppText>
  );
}

export function EntryCard({ entry, transcript, onPress, snippet, showDate, vaultConnected = false, onDelete }: Props) {
  const [showDelete, setShowDelete] = useState(false);

  const compressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';
  const sttActive =
    !snippet && (entry.sttStatus === 'pending' || entry.sttStatus === 'processing');
  const isAudio = entry.mode === 'audio';
  const isText = entry.mode === 'text';
  const preview = snippet ? null : isText ? (entry.manualNote ?? null) : firstLine(transcript);

  return (
    <>
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: opacity.pressed }}>
      <Card padding={spacing.md} style={styles.card}>
        <View style={styles.row}>
          {/* 썸네일 */}
          <View style={[styles.thumb, isText ? styles.thumbText : isAudio ? styles.thumbAudio : styles.thumbVideo]}>
            {!isText && entry.thumbnailPath && !isAudio ? (
              <Image source={{ uri: entry.thumbnailPath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons
                name={isText ? 'create-outline' : isAudio ? 'mic' : 'videocam'}
                size={iconSize.lg}
                color={isText ? colors.text.tertiary : colors.text.onMedia}
              />
            )}
            {compressing && !isText && (
              <View style={styles.thumbOverlay}>
                <AppText preset="caption" color={colors.text.onMedia}>압축 중</AppText>
              </View>
            )}
          </View>

          {/* 본문 */}
          <View style={styles.body}>
            {showDate && (
              <AppText preset="caption" color={colors.text.tertiary}>
                {format(new Date(entry.recordedAt), 'yyyy년 M월 d일', { locale: ko })}
              </AppText>
            )}
            <View style={styles.metaRow}>
              <AppText preset="caption" color={colors.text.primary}>
                {format(new Date(entry.recordedAt), 'a h:mm', { locale: ko })}
              </AppText>
              {!isText && (
                <AppText preset="caption" color={colors.text.tertiary}>· {fmtDuration(entry.durationMs)}</AppText>
              )}
              {entry.mode === 'silent' && <Tag label="조용" bg={colors.surface.sunken} color={colors.text.secondary} />}
              {isAudio && <Tag label="녹음" bg={colors.surface.sunken} color={colors.text.secondary} />}
              {isText && <Tag label="메모" bg={colors.surface.sunken} color={colors.text.secondary} />}
            </View>

            {snippet ? (
              <SnippetText text={snippet} />
            ) : sttActive ? (
              <AppText preset="bodySmall" color={colors.text.tertiary}>분석 중…</AppText>
            ) : preview ? (
              <AppText preset="bodySmall" color={colors.text.secondary} numberOfLines={2}>{preview}</AppText>
            ) : (entry.mode === 'voice' || isAudio) ? (
              <AppText preset="bodySmall" color={colors.text.tertiary}>
                {entry.sttStatus === 'skipped' ? '음성 없음' : '트랜스크립트 없음'}
              </AppText>
            ) : isText ? (
              <AppText preset="bodySmall" color={colors.text.tertiary}>내용 없음</AppText>
            ) : null}

            {(compressing || sttActive) && !isText && (
              <View style={styles.badgeRow}>
                {compressing && <Tag label="압축 중" bg={colors.feedback.warningTrack} color={colors.feedback.warning} />}
                {sttActive && <Tag label="STT 처리 중" bg={colors.feedback.warningTrack} color={colors.feedback.warning} />}
              </View>
            )}
          </View>

          {/* 삭제 버튼 — onDelete prop이 있을 때만 표시 */}
          {onDelete && (
            <Pressable onPress={() => setShowDelete(true)} style={styles.deleteCol} hitSlop={spacing.xs}>
              <AppText preset="caption" color={colors.feedback.danger}>삭제</AppText>
            </Pressable>
          )}
        </View>
      </Card>
    </Pressable>

    {onDelete && (
      <DeleteEntryDialog
        visible={showDelete}
        vaultConnected={vaultConnected}
        onCancel={() => setShowDelete(false)}
        onConfirm={(opts) => { setShowDelete(false); onDelete(opts); }}
      />
    )}
    </>
  );
}

const THUMB = 76;

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: radius.md,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  thumbVideo: { backgroundColor: colors.media.thumbSlate },
  thumbAudio: { backgroundColor: colors.media.thumbNavy },
  thumbText: { backgroundColor: colors.surface.sunken, borderWidth: 1, borderColor: colors.border.card },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.media.controlScrim,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  snippetHl: { backgroundColor: colors.accent.highlight, color: colors.text.primary, fontFamily: fontFamily.bodyBold, fontWeight: fontWeight.bold },
  deleteCol: {
    alignSelf: 'stretch', justifyContent: 'center',
    paddingLeft: spacing.md, marginLeft: spacing.xs,
    borderLeftWidth: 1, borderLeftColor: colors.border.hairline,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
});
