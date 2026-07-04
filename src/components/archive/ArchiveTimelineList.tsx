import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { EntryCard } from '@/components/EntryCard';
import { ArchiveEmpty } from '@/components/archive/ArchiveEmpty';
import { TimelineDecisionItem } from '@/components/archive/TimelineDecisionItem';
import { TimelineMemoItem } from '@/components/archive/TimelineMemoItem';
import { TimelineSeparator, bucketFor, type TimelineLevel } from '@/components/archive/TimelineSeparator';
import type { TimelineDecision } from '@/db/repos/decisions';
import type { EntryWithTranscript } from '@/stores/archive';
import type { Decision, Entry } from '@/types/domain';
import { colors, layout, spacing } from '@/theme';

// 타임라인 병합 행 — Entry와 결정 인레이를 한 시간축에.
export type TimelineRow =
  | { kind: 'entry'; key: string; sortTs: number; item: EntryWithTranscript }
  | { kind: 'decision'; key: string; sortTs: number; td: TimelineDecision }
  | { kind: 'sep'; key: string; sortTs: number; level: TimelineLevel; label: string };

// Entry + 결정 인레이 병합(순수 함수). 결정은 아직 로드된 Entry 시간 범위까지만 노출
// (더 오래된 Entry가 로드되면 그 시점의 결정도 함께 보이도록).
export function buildTimelineRows(
  items: EntryWithTranscript[],
  decisions: TimelineDecision[],
  hasMore: boolean,
): TimelineRow[] {
  const entryRows: TimelineRow[] = items.map((it) => ({
    kind: 'entry', key: `e:${it.entry.id}`, sortTs: it.entry.recordedAt, item: it,
  }));
  const cutoff = hasMore && items.length > 0
    ? items[items.length - 1].entry.recordedAt
    : Number.NEGATIVE_INFINITY;
  const decisionRows: TimelineRow[] = decisions
    .filter((d) => d.sortTs >= cutoff)
    .map((d) => ({ kind: 'decision', key: `d:${d.decision.id}`, sortTs: d.sortTs, td: d }));
  const merged = [...entryRows, ...decisionRows].sort((a, b) => b.sortTs - a.sortTs);
  // 시간 단위(오늘/일/주/월/년) 구분선 삽입 — 버킷 키가 바뀌는 첫 항목 앞에.
  const now = new Date();
  const out: TimelineRow[] = [];
  let lastKey = '';
  for (const row of merged) {
    const b = bucketFor(row.sortTs, now);
    if (b.key !== lastKey) {
      out.push({ kind: 'sep', key: `sep:${b.key}`, sortTs: row.sortTs, level: b.level, label: b.label });
      lastKey = b.key;
    }
    out.push(row);
  }
  return out;
}

type DeleteOpts = { deleteFiles: boolean; deleteFromVault: boolean };

interface Props {
  rows: TimelineRow[];
  loading: boolean;
  refreshing: boolean;
  vaultConnected: boolean;
  bottomInset: number; // 탭바 높이 등 하단 여백
  onRefresh(): void;
  onEndReached(): void;
  onEditDecision(decision: Decision): void;
  onSaveMemo(entryId: string, text: string): void;
  onDeleteEntry(entry: Entry, opts: DeleteOpts): void;
  onPressEntry(entryId: string): void;
  onCta(): void; // 빈 상태 '기록 남기기'
}

// 아카이브 타임라인 피드 — 순수 표현 컴포넌트. 데이터 로드/상태는 부모가 props로 주입.
export function ArchiveTimelineList({
  rows, loading, refreshing, vaultConnected, bottomInset,
  onRefresh, onEndReached, onEditDecision, onSaveMemo, onDeleteEntry, onPressEntry, onCta,
}: Props) {
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand.primary}
          colors={[colors.brand.primary]}
        />
      }
      renderItem={({ item: row }) => {
        if (row.kind === 'sep') return <TimelineSeparator level={row.level} label={row.label} />;
        if (row.kind === 'decision') {
          return (
            <TimelineDecisionItem
              decision={row.td.decision}
              sortTs={row.td.sortTs}
              onPress={() => onEditDecision(row.td.decision)}
            />
          );
        }
        const it = row.item;
        // 메모(결정 없는 텍스트)는 썸네일 없이 인라인 수정.
        if (it.entry.mode === 'text' && !it.decision) {
          return (
            <TimelineMemoItem
              entry={it.entry}
              onSave={(text) => onSaveMemo(it.entry.id, text)}
              onDelete={() => onDeleteEntry(it.entry, { deleteFiles: false, deleteFromVault: false })}
            />
          );
        }
        return (
          <EntryCard
            entry={it.entry}
            transcript={it.transcript}
            decision={it.decision}
            showDate
            vaultConnected={vaultConnected}
            onPress={() => (it.entry.mode === 'text' && it.decision
              ? onEditDecision(it.decision)
              : onPressEntry(it.entry.id))}
            onDelete={(opts) => onDeleteEntry(it.entry, opts)}
          />
        );
      }}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + spacing.lg }]}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        loading ? null : (
          <ArchiveEmpty
            icon="archive"
            message="아직 남긴 기록이 없어요"
            ctaLabel="기록 남기기"
            onCta={onCta}
          />
        )
      }
      ListFooterComponent={
        loading ? (
          <View style={styles.centeredRow}><ActivityIndicator color={colors.brand.primary} /></View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: layout.screenPaddingX },
  centeredRow: { paddingVertical: spacing['2xl'], alignItems: 'center' },
});
