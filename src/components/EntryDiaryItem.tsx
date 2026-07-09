import { Icon } from '@/components/ui';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppearIn, AppText, LinedPaper, Pin, Polaroid, PostIt, Pulse, Tag, Tape } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';
import type { Decision, Entry, Transcript } from '@/types/domain';

const COLLAPSED_LINES = 3;

function transcriptBody(t: Transcript | null): string | null {
  const text = t?.editedText ?? t?.rawText;
  return text?.trim() ?? null;
}

/** 본문을 제목(첫 문장/줄)과 나머지로 분리 — 별도 title 컬럼이 없어 시각적 위계만 부여 */
function splitTitleBody(text: string): { title: string; body?: string } {
  const nl = text.indexOf('\n');
  if (nl > 0) return { title: text.slice(0, nl).trim(), body: text.slice(nl + 1).trim() || undefined };
  const m = text.match(/^(.{1,40}?[.!?。…])\s+(.+)$/s);
  if (m) return { title: m[1].trim(), body: m[2].trim() };
  return { title: text };
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 표면별 텍스트 잉크 — 일반 종이(기본) vs 포스트잇(파스텔 위 진한 잉크). */
type Ink = { strong: string; muted: string; faint: string };
const PAPER_INK: Ink = { strong: colors.text.primary, muted: colors.text.secondary, faint: colors.text.tertiary };
const STICKY_INK: Ink = { strong: colors.text.onSticky, muted: colors.text.onStickyMuted, faint: colors.text.onStickyFaint };

/** 제목 + (탭하면 접히는) 본문 + 상태 텍스트. 트랜스크립트 탭 → 접기 토글. */
function TranscriptBlock({
  source, emptyText, danger, active, collapsible = true, ink = PAPER_INK,
}: { source: string | null; emptyText: string | null; danger?: boolean; active?: boolean; collapsible?: boolean; ink?: Ink }) {
  const [collapsed, setCollapsed] = useState(false);
  const split = source ? splitTitleBody(source) : null;
  const canCollapse = collapsible && !!split?.body && (split.body.length > 90 || split.body.includes('\n'));

  return (
    <>
      {/* 트랜스크립트가 도착하면(키 변경) 페이드인 */}
      <AppearIn key={source ? 'has' : 'none'} distance={6}>
        {split && (
          <AppText preset="titleMedium" color={ink.strong} numberOfLines={2} style={styles.title}>
            {split.title}
          </AppText>
        )}
        {split?.body && (
          collapsible ? (
            <Pressable onPress={() => setCollapsed((c) => !c)}>
              <AppText preset="bodyMedium" color={ink.muted} numberOfLines={collapsed ? COLLAPSED_LINES : undefined}>
                {split.body}
              </AppText>
              {canCollapse && (
                <AppText preset="caption" color={colors.text.link} style={styles.toggle}>
                  {collapsed ? '더보기' : '접기'}
                </AppText>
              )}
            </Pressable>
          ) : (
            <AppText preset="bodyMedium" color={ink.muted} numberOfLines={COLLAPSED_LINES}>
              {split.body}
            </AppText>
          )
        )}
      </AppearIn>
      {/* 처리 중(압축/STT) 상태는 은은히 맥동 — '작동 중' 신호 */}
      {emptyText && (
        <Pulse active={!!active} maxScale={1}>
          <AppText preset="bodySmall" color={danger ? colors.feedback.danger : ink.faint}>
            {emptyText}
          </AppText>
        </Pulse>
      )}
    </>
  );
}

interface Props {
  entry: Entry;
  transcript: Transcript | null;
  /** 이 텍스트 엔트리가 대표하는 결정 (있으면 '의사결정'으로 표기) */
  decision?: Decision | null;
  onPress?: () => void;
}

export function EntryDiaryItem({ entry, transcript, decision, onPress }: Props) {
  if (entry.mode === 'audio') return <EntryAudioItem entry={entry} transcript={transcript} />;

  const time = format(new Date(entry.recordedAt), 'a h:mm', { locale: ko });
  const compressing =
    entry.compressionStatus === 'pending' || entry.compressionStatus === 'processing';
  const sttActive = entry.sttStatus === 'pending' || entry.sttStatus === 'processing';
  const sttFailed = entry.sttStatus === 'failed';
  const isText = entry.mode === 'text';
  const isPhoto = entry.mode === 'photo';

  const source =
    transcriptBody(transcript) ?? (entry.mode === 'silent' ? entry.manualNote ?? null : null) ?? entry.manualNote ?? null;
  const noSpeech = entry.sttStatus === 'skipped' && entry.mode !== 'silent' && entry.mode !== 'text' && entry.mode !== 'photo';
  const emptyText = compressing
    ? '압축 중…'
    : sttActive
      ? '음성을 텍스트로 변환 중…'
      : sttFailed
        ? 'STT 실패'
        : noSpeech && !source
          ? '음성 없음'
          : !source
            ? (entry.mode === 'silent' || isPhoto) ? '메모 없음' : '트랜스크립트 없음'
            : null;

  const renderMeta = (faint: string) => (
    <View style={styles.metaRow}>
      <AppText preset="caption" color={faint}>{time}</AppText>
      {!compressing && !sttActive && !sttFailed && source && (
        <View style={styles.statusRow}>
          <Icon name="check-circle" size={iconSize.sm} color={colors.feedback.success} />
          <AppText preset="caption" color={colors.feedback.success}>변환 완료</AppText>
        </View>
      )}
      {compressing && <Tag label="압축 중" bg={colors.feedback.warningTrack} color={colors.feedback.warning} />}
      {sttActive && !compressing && <Tag label="분석 중" bg={colors.feedback.warningTrack} color={colors.feedback.warning} />}
      {sttFailed && <Tag label="STT 실패" bg={colors.feedback.warningTrack} color={colors.feedback.danger} />}
      {entry.mode === 'silent' && <Tag label="조용 모드" bg={colors.surface.sunken} color={colors.text.secondary} />}
      {isText && (
        decision
          ? <Tag label="의사결정" bg={colors.brand.tint} color={colors.brand.primary} />
          : <Tag label="메모" />
      )}
    </View>
  );

  const footer = (
    <>
      {renderMeta(colors.text.tertiary)}
      <TranscriptBlock source={source} emptyText={emptyText} danger={sttFailed} active={compressing || sttActive} />
    </>
  );

  // ── 의사결정: 아래가 살짝 들뜬 포스트잇 + 압정. 파스텔 배경 위 진한 잉크. 탭 → 결정 수정 ──
  if (isText && decision) {
    return (
      <Pressable onPress={onPress}>
        <View style={styles.cardWrap}>
          <View style={styles.cornerPin} pointerEvents="none"><Pin size={20} vary={entry.id} /></View>
          <PostIt lift vary={entry.id} containerStyle={styles.postitOuter} style={styles.postitBody}>
            {renderMeta(STICKY_INK.faint)}
            <TranscriptBlock source={source} emptyText={emptyText} danger={sttFailed} active={compressing || sttActive} collapsible={false} ink={STICKY_INK} />
          </PostIt>
        </View>
      </Pressable>
    );
  }

  // ── 메모: 가로줄 공책을 잘라 붙인 종이 + 테이프. 탭 → 편집 ──
  if (isText) {
    const memoTilt = entry.id.charCodeAt(entry.id.length - 1) % 2 === 0 ? -1.5 : 1.5;
    return (
      <Pressable onPress={onPress}>
        <View style={styles.cardWrap}>
          <View style={styles.cornerTape} pointerEvents="none"><Tape width={44} height={16} angle={-10} vary={entry.id} /></View>
          <LinedPaper torn tilt={memoTilt} style={styles.textCard}>
            {renderMeta(colors.text.tertiary)}
            <TranscriptBlock source={source} emptyText={emptyText} danger={sttFailed} active={compressing || sttActive} collapsible={false} />
          </LinedPaper>
        </View>
      </Pressable>
    );
  }

  // ── 영상: 큰 폴라로이드 + 테이프 + 살짝 기울임. 썸네일 탭 → 상세 ──
  const tilt = entry.id.charCodeAt(entry.id.length - 1) % 2 === 0 ? -2 : 1.5;
  return (
    <View style={styles.item}>
      <View style={styles.tapeWrap} pointerEvents="none">
        <Tape angle={-6} vary={entry.id} />
      </View>
      <Polaroid
        tilt={tilt}
        aspectRatio={16 / 9}
        duration={isPhoto ? undefined : entry.durationMs}
        footer={footer}
        typeIcon={
          <View style={styles.typeChip}>
            <Icon name={isPhoto ? 'photo' : 'video'} size={iconSize.sm} color={colors.text.onMedia} />
          </View>
        }
      >
        <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, styles.mediaTint]}>
            {entry.thumbnailPath && (
              <Image source={{ uri: entry.thumbnailPath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            )}
          </View>
        </Pressable>
      </Polaroid>
    </View>
  );
}

/** 음성 항목 — 썸네일 없이 메모형 카드 + 재생 버튼. */
function EntryAudioItem({ entry, transcript }: { entry: Entry; transcript: Transcript | null }) {
  const player = useAudioPlayer(entry.originalPath);
  const status = useAudioPlayerStatus(player);
  const time = format(new Date(entry.recordedAt), 'a h:mm', { locale: ko });
  const sttActive = entry.sttStatus === 'pending' || entry.sttStatus === 'processing';
  const sttFailed = entry.sttStatus === 'failed';
  const source = transcriptBody(transcript) ?? entry.manualNote ?? null;
  const emptyText = sttActive
    ? '음성을 텍스트로 변환 중…'
    : sttFailed
      ? 'STT 실패'
      : entry.sttStatus === 'skipped' && !source
        ? '음성 없음'
        : !source ? '트랜스크립트 없음' : null;

  const togglePlay = () => { if (status.playing) player.pause(); else player.play(); };
  const memoTilt = entry.id.charCodeAt(entry.id.length - 1) % 2 === 0 ? 1.5 : -1.5;

  return (
    <View style={styles.cardWrap}>
      <View style={styles.cornerTape} pointerEvents="none"><Tape width={44} height={16} angle={-10} vary={entry.id} /></View>
      <LinedPaper torn tilt={memoTilt} style={styles.textCard}>
      <View style={styles.metaRow}>
        <AppText preset="caption" color={colors.text.tertiary}>{time}</AppText>
        <Tag label="녹음" bg={colors.surface.sunken} color={colors.text.secondary} />
        {sttActive && <Tag label="분석 중" bg={colors.feedback.warningTrack} color={colors.feedback.warning} />}
        {sttFailed && <Tag label="STT 실패" bg={colors.feedback.warningTrack} color={colors.feedback.danger} />}
      </View>

      <View style={styles.audioRow}>
        <Pressable onPress={togglePlay} style={styles.playBtn}>
          <Icon name={status.playing ? 'pause' : 'play'} size={iconSize.md} color={colors.brand.onPrimary} />
        </Pressable>
        <AppText preset="caption" color={colors.text.secondary}>{fmtDuration(entry.durationMs)}</AppText>
      </View>

      <TranscriptBlock source={source} emptyText={emptyText} danger={sttFailed} active={sttActive} />
      </LinedPaper>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { marginTop: spacing.md, marginBottom: spacing.xl },
  tapeWrap: { position: 'absolute', top: -spacing.sm, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  cardWrap: { marginTop: spacing.sm },
  cornerTape: { position: 'absolute', top: -spacing.xs, left: spacing.lg, zIndex: 2 },
  cornerPin: { position: 'absolute', top: -spacing.xs, right: spacing.lg, zIndex: 2 },
  textCard: { marginBottom: spacing.md },
  postitOuter: { marginBottom: spacing.md },
  postitBody: { gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { marginTop: spacing.xs, marginBottom: spacing.xs },
  toggle: { marginTop: spacing.xs },
  typeChip: { backgroundColor: colors.media.durationPillBg, borderRadius: radius.sm, padding: spacing.xs },
  mediaTint: { backgroundColor: colors.media.thumbSlate },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  playBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center',
  },
});
