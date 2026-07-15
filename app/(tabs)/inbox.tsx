/** @codemap 인박스 탭(/inbox) — 처리 전용: AI 추출 컨펌(덱) + 지금 확인(후속 도래·마감 도래 미결)
 *  데이터: getSettings·searchDecisions·insertDecisionLink(@/db) · 상태 stores/inbox · 보드 components/decision/DecisionBoard
 *  관련 ADR: 006(컨펌), 016(원본 보존), 017(후속), 028(미결). 진행중/완료/통계/전체목록은 결정 탭(I2).
 */
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { DecisionBoard } from '@/components/decision/DecisionBoard';
import { DecisionDeck } from '@/components/DecisionDeck';
import { LowConfidenceCandidates } from '@/components/inbox/LowConfidenceCandidates';
import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { SimilarDecisionsSheet } from '@/components/decision/SimilarDecisionsSheet';
import { PastDecisionsSheet } from '@/components/decision/PastDecisionsSheet';
import { AppText, EmptyInboxArt, Highlight, type IconName, IllustrationSlot, ScreenBackground } from '@/components/ui';
import { getSettings, insertDecisionLink, searchDecisions } from '@/db';
import type { DecisionSearchResult, SimilarPastItem } from '@/db';
import { haptics } from '@/lib/haptics';
import { nowMs } from '@/lib/time';
import { openEntryInObsidian } from '@/lib/obsidian';
import { useInboxStore, type DecisionWithEntry } from '@/stores/inbox';
import { colors, layout, spacing } from '@/theme';

// E2(b): 이 값 미만 확신도는 덱에서 빼 접힘 그룹으로.
const LOW_CONFIDENCE_THRESHOLD = 0.6;

export default function InboxScreen() {
  const db = useSQLiteContext();
  const {
    pendingCandidates, dueFollowUps, deliberatingDecisions,
    loading, loadInbox, confirmDecision, discardCandidate,
  } = useInboxStore();

  // 덱 후보 컨펌 편집(confirm=true)
  const [editTarget, setEditTarget] = useState<DecisionWithEntry | null>(null);
  // D4-b: 확정 직후 비슷한 과거 결정 제안
  const [similar, setSimilar] = useState<{ fromId: string; candidates: DecisionSearchResult[] } | null>(null);
  // F1: 확정 전 유사 과거 결정 열람(배지 탭)
  const [pastItems, setPastItems] = useState<SimilarPastItem[] | null>(null);

  const tabBarHeight = useBottomTabBarHeight();
  useFocusEffect(useCallback(() => { loadInbox(db); }, [db, loadInbox]));

  // 확정 안내 — 사용자가 선택할 때만 옵시디언을 연다(무단 앱 전환 금지, DecisionBoard와 동일 UX).
  const obsidianPrompt = useCallback(async (recordedAt: number) => {
    const settings = await getSettings(db);
    if (!settings.obsidianVaultUri) return;
    Alert.alert('결정 확정됨', '잠시 후 옵시디언 노트에 반영됩니다.', [
      { text: '닫기', style: 'cancel' },
      { text: '옵시디언에서 열기', onPress: () => openEntryInObsidian(db, recordedAt) },
    ]);
  }, [db]);

  const handleConfirmItem = useCallback(async (item: DecisionWithEntry) => {
    haptics.success();
    await confirmDecision(db, item.decision.id);
    // D4-b: 확정 직후 비슷한 과거 결정 제안(자동 저장 없음 — 고른 것만 저장).
    try {
      const summary = item.decision.userSummary ?? item.decision.summary;
      const results = await searchDecisions(db, summary, 12);
      const candidates = results.filter((r) =>
        r.decision.id !== item.decision.id &&
        r.decision.entryId !== item.decision.entryId &&
        (r.decision.status === 'confirmed' || r.decision.status === 'edited'),
      ).slice(0, 3);
      if (candidates.length > 0) setSimilar({ fromId: item.decision.id, candidates });
    } catch (e) {
      console.warn('[inbox] similar suggest failed', e);
    }
  }, [db, confirmDecision]);

  const handleSaveSimilar = useCallback(async (selectedIds: string[]) => {
    const target = similar;
    setSimilar(null);
    if (!target) return;
    for (const toId of selectedIds) {
      await insertDecisionLink(db, { fromDecisionId: target.fromId, toDecisionId: toId, linkType: 'similar' });
    }
  }, [db, similar]);

  const now = nowMs();
  // I2: Inbox는 마감 도래 미결만(미도래는 결정 탭 '고민 중'에).
  const dueDeliberating = deliberatingDecisions.filter(
    (i) => i.decision.decideBy != null && i.decision.decideBy <= now,
  );
  const totalPending = pendingCandidates.length;
  const highPending = pendingCandidates.filter((i) => i.decision.confidence >= LOW_CONFIDENCE_THRESHOLD);
  const lowPending = pendingCandidates.filter((i) => i.decision.confidence < LOW_CONFIDENCE_THRESHOLD);
  const hasDue = dueFollowUps.length + dueDeliberating.length > 0;
  const hasAnything = totalPending + dueFollowUps.length + dueDeliberating.length > 0;

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Highlight vary="inbox-title">
          <AppText preset="displayCompact">Inbox</AppText>
        </Highlight>
        <AppText preset="caption" color={colors.text.secondary}>
          {`검토 ${totalPending} · 후속 ${dueFollowUps.length} · 마감 미결 ${dueDeliberating.length}`}
        </AppText>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color={colors.brand.primary} />}

      {!loading && !hasAnything && (
        <EmptyState icon="deck" title="처리할 항목이 없어요" hint="AI가 결정을 추출하거나 후속 확인이 도래하면 여기에 모입니다." />
      )}

      {!loading && hasDue && (
        <View style={styles.dueWrap}>
          <ScrollView contentContainerStyle={styles.dueScroll} keyboardShouldPersistTaps="handled">
            <DecisionBoard
              deliberating={dueDeliberating}
              dueFollowUps={dueFollowUps}
              upcoming={[]}
              reflection={[]}
            />
          </ScrollView>
        </View>
      )}

      {!loading && totalPending > 0 && (
        <View style={[styles.deckArea, { paddingBottom: tabBarHeight }]}>
          {lowPending.length > 0 && (
            <View style={styles.lowWrap}>
              <LowConfidenceCandidates
                items={lowPending}
                onConfirm={handleConfirmItem}
                onReject={(item) => { haptics.warning(); discardCandidate(db, item.decision.id); }}
                onEdit={(item) => setEditTarget(item)}
                onShowPast={(item) => setPastItems(item.similarPast ?? [])}
              />
            </View>
          )}
          {highPending.length > 0 ? (
            <View style={styles.deck}>
              <DecisionDeck
                items={highPending}
                onConfirm={handleConfirmItem}
                onReject={(item) => { haptics.warning(); discardCandidate(db, item.decision.id); }}
                onEdit={(item) => setEditTarget(item)}
                onShowPast={(item) => setPastItems(item.similarPast ?? [])}
              />
            </View>
          ) : (
            <EmptyState icon="deck" title="확신 높은 후보는 없어요" hint="위 '낮은 확신 후보'를 펼쳐 확인하세요." />
          )}
        </View>
      )}

      {similar && (
        <SimilarDecisionsSheet
          candidates={similar.candidates}
          onSave={handleSaveSimilar}
          onClose={() => setSimilar(null)}
        />
      )}

      {pastItems && (
        <PastDecisionsSheet items={pastItems} onClose={() => setPastItems(null)} />
      )}

      {editTarget && (
        <EditDecisionSheet
          key={editTarget.decision.id}
          visible
          decision={editTarget.decision}
          onCancel={() => setEditTarget(null)}
          onSave={async (edits) => {
            const item = editTarget;
            setEditTarget(null);
            await confirmDecision(db, item.decision.id, edits);
            await obsidianPrompt(item.entry.recordedAt);
          }}
        />
      )}
    </ScreenBackground>
  );
}

function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint: string }) {
  return (
    <View style={styles.empty}>
      <IllustrationSlot name={`inbox-${icon}`} placeholder={<EmptyInboxArt />} size={150} />
      <AppText preset="titleMedium">{title}</AppText>
      <AppText preset="bodyMedium" color={colors.text.tertiary}>{hint}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm, gap: spacing.xs },
  loader: { marginTop: spacing['4xl'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  dueWrap: { maxHeight: '45%' },
  dueScroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing.md },
  deckArea: { flex: 1, paddingHorizontal: layout.screenPaddingX },
  deck: { flex: 1 },
  lowWrap: { paddingBottom: spacing.sm },
});
