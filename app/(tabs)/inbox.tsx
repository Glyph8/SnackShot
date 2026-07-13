/** @codemap 인박스 탭(/inbox) — AI 추출 컨펌(덱) + 결정 보드(진행 중 todo · 후속 확인)
 *  데이터: getSettings(@/db) · 상태 stores/inbox · 관련 ADR: 006(컨펌), 016(원본 보존), 017(후속/수행)
 */
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, StyleSheet, View,
} from 'react-native';

import { DecisionBoardCard } from '@/components/DecisionBoardCard';
import { DecisionDeck } from '@/components/DecisionDeck';
import { DecisionDoneRow } from '@/components/DecisionDoneRow';
import { DecisionList } from '@/components/decision/DecisionList';
import { LowConfidenceCandidates } from '@/components/inbox/LowConfidenceCandidates';
import { DeliberatingCard } from '@/components/inbox/DeliberatingCard';
import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { FollowUpCard } from '@/components/FollowUpCard';
import { OutcomeEditor } from '@/components/OutcomeEditor';
import { SimilarDecisionsSheet } from '@/components/decision/SimilarDecisionsSheet';
import { PastDecisionsSheet } from '@/components/decision/PastDecisionsSheet';
import { ActionSheet, type ActionItem, AppearIn, AppText, EmptyInboxArt, Highlight, Icon, type IconName, IllustrationSlot, ScreenBackground } from '@/components/ui';
import type { OutcomeResult } from '@/types/domain';
import { getSettings, getSimilarPastDecisions, insertDecisionLink, searchDecisions } from '@/db';
import type { DecisionSearchResult, SimilarPastItem } from '@/db';
import { haptics } from '@/lib/haptics';
import { openEntryInObsidian } from '@/lib/obsidian';
import { useInboxStore, type DecisionWithEntry, type InboxViewMode } from '@/stores/inbox';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

// E2(b): 이 값 미만 확신도는 덱에서 빼 접힘 그룹으로. 추후 설정화 여지.
const LOW_CONFIDENCE_THRESHOLD = 0.6;

export default function InboxScreen() {
  const db = useSQLiteContext();
  const {
    pendingCandidates, dueFollowUps, upcomingDecisions, reflectionDecisions,
    loading, viewMode, setViewMode,
    deliberatingDecisions,
    loadInbox, confirmDecision, editDecision, discardCandidate, rejectDecision, recordOutcome, reFollowDecision, decideDeliberating, discardDeliberating, markExecuted, unmarkExecuted,
  } = useInboxStore();

  // 편집 대상. confirm=true(덱 후보 컨펌) / false(이미 확정된 보드 결정 수정)
  const [editTarget, setEditTarget] = useState<{ item: DecisionWithEntry; confirm: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionTarget, setActionTarget] = useState<DecisionWithEntry | null>(null);
  // D4-b: 확정 직후 비슷한 과거 결정 제안 대상
  const [similar, setSimilar] = useState<{ fromId: string; candidates: DecisionSearchResult[] } | null>(null);
  // F1: 확정 전 유사 과거 결정 열람 대상(배지 탭)
  const [pastItems, setPastItems] = useState<SimilarPastItem[] | null>(null);
  // F5/ADR-028: 미결→확정 "결정했다" 플로우(과거 개입 시트 → 편집 시트)
  const [decideTarget, setDecideTarget] = useState<{ item: DecisionWithEntry; similarPast: SimilarPastItem[]; stage: 'past' | 'edit' } | null>(null);

  // 진행 중 결정 카드 롱프레스 빠른 액션
  const at = actionTarget;
  const boardActions: ActionItem[] = at ? [
    { label: '수정', icon: 'open', onPress: () => setEditTarget({ item: at, confirm: false }) },
    { label: '완료 처리', icon: 'check', onPress: () => markExecuted(db, at.decision.id) },
    { label: '결정 취소', icon: 'trash', destructive: true, onPress: () => { haptics.warning(); rejectDecision(db, at.decision.id); } },
  ] : [];
  // 결과 기록 인라인 확장 대상 (모달 대신 카드 아래에서 펼침)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tabBarHeight = useBottomTabBarHeight();

  useFocusEffect(useCallback(() => { loadInbox(db); }, [db, loadInbox]));

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // F4: unclear/mixed 결과 기록 직후 "7일 뒤 다시 물어볼까요?" 제안. 수락 시 재후속으로 재예약.
  // 회고/교훈을 적었다면 잠정 판단이 아니라 실질 회고다 — 재후속 수락 시 outcome soft-delete로
  // 그 텍스트가 소실되므로(F4 편차의 부작용) 메모가 있으면 제안하지 않는다(사용자 텍스트 보호).
  const proposeRefollow = useCallback((id: string, result: OutcomeResult, hasMemo: boolean) => {
    if (result !== 'unclear' && result !== 'mixed') return;
    if (hasMemo) return;
    Alert.alert('결과 기록됨', '아직 판단하기 이르다면 7일 뒤 다시 물어볼까요?', [
      { text: '아니요', style: 'cancel' },
      { text: '7일 뒤 다시', onPress: () => reFollowDecision(db, id) },
    ]);
  }, [db, reFollowDecision]);

  const handleRecordOutcome = useCallback(async (id: string, result: OutcomeResult, reflection?: string, learnings?: string) => {
    await recordOutcome(db, id, result, reflection, learnings);
    proposeRefollow(id, result, !!(reflection?.trim() || learnings?.trim()));
  }, [db, recordOutcome, proposeRefollow]);

  const handleOutcome = useCallback((id: string, result: OutcomeResult, reflection?: string, learnings?: string) => {
    setExpandedId(null);
    handleRecordOutcome(id, result, reflection, learnings);
  }, [handleRecordOutcome]);

  const handleOutcomeVideo = useCallback((id: string) => {
    setExpandedId(null);
    router.push({ pathname: '/record', params: { decisionId: id } });
  }, []);

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
    await obsidianPrompt(item.entry.recordedAt);
    // D4-b: 확정 직후 비슷한 과거 결정 제안 (자동 저장 없음 — 사용자가 고른 것만 저장).
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
  }, [db, confirmDecision, obsidianPrompt]);

  const handleSaveSimilar = useCallback(async (selectedIds: string[]) => {
    const target = similar;
    setSimilar(null);
    if (!target) return;
    for (const toId of selectedIds) {
      await insertDecisionLink(db, { fromDecisionId: target.fromId, toDecisionId: toId, linkType: 'similar' });
    }
  }, [db, similar]);

  // F5: 미결 "결정했다" — 과거 개입(F1) 자동 표시 후 EditDecisionSheet로 확정 전이.
  const handleDecideDeliberating = useCallback(async (item: DecisionWithEntry) => {
    let similarPast: SimilarPastItem[] = [];
    try {
      const q = item.decision.userSummary ?? item.decision.summary;
      similarPast = await getSimilarPastDecisions(db, q, { excludeEntryId: item.decision.entryId, limit: 3 });
    } catch (e) {
      console.warn('[inbox] deliberating similar fetch failed', e);
    }
    setDecideTarget({ item, similarPast, stage: similarPast.length > 0 ? 'past' : 'edit' });
  }, [db]);

  const totalPending = pendingCandidates.length;
  const highPending = pendingCandidates.filter((i) => i.decision.confidence >= LOW_CONFIDENCE_THRESHOLD);
  const lowPending = pendingCandidates.filter((i) => i.decision.confidence < LOW_CONFIDENCE_THRESHOLD);
  const totalDue = dueFollowUps.length;
  const totalUpcoming = upcomingDecisions.length;
  const totalReflection = reflectionDecisions.length;
  const totalDeliberating = deliberatingDecisions.length;
  const hasBoard = totalDue + totalUpcoming + totalReflection + totalDeliberating > 0;
  const showDeck = viewMode === 'deck';
  const showBoard = viewMode === 'board';
  const showList = viewMode === 'list';

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Highlight vary="inbox-title">
            <AppText preset="displayCompact">Inbox</AppText>
          </Highlight>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setViewMode('deck')}
              hitSlop={spacing.sm}
              style={[styles.reviewBtn, showDeck && styles.reviewBtnOn]}
              accessibilityLabel="검토 대기"
            >
              <Icon name="deck" size={iconSize.md} color={showDeck ? colors.brand.onPrimary : colors.text.secondary} />
              {totalPending > 0 && (
                <View style={styles.reviewBadge}>
                  <AppText preset="micro" color={colors.brand.onPrimary}>{totalPending}</AppText>
                </View>
              )}
            </Pressable>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </View>
        </View>
        <AppText preset="caption" color={colors.text.secondary}>
          {showDeck
            ? `검토 대기 ${totalPending}건`
            : showList
              ? '전체 의사결정 기록'
              : `진행 중 ${totalUpcoming} · 회고 ${totalReflection} · 후속 ${totalDue}`}
        </AppText>
      </View>

      {loading && !showList && <ActivityIndicator style={styles.loader} color={colors.brand.primary} />}

      {/* 전체 목록 — /decisions와 공유하는 본문 */}
      {showList && <DecisionList bottomInset={tabBarHeight} showInsights />}

      {/* 덱 모드 — AI 추출 후보 컨펌. 낮은 확신(<0.6)은 접힘 그룹으로 분리(E2b). */}
      {!loading && showDeck && (
        totalPending > 0 ? (
          <View style={[styles.flex, { paddingBottom: tabBarHeight }]}>
            {lowPending.length > 0 && (
              <View style={styles.lowWrap}>
                <LowConfidenceCandidates
                  items={lowPending}
                  onConfirm={handleConfirmItem}
                  onReject={(item) => { haptics.warning(); discardCandidate(db, item.decision.id); }}
                  onEdit={(item) => setEditTarget({ item, confirm: true })}
                  onShowPast={(item) => setPastItems(item.similarPast ?? [])}
                />
              </View>
            )}
            {highPending.length > 0 ? (
              <View style={styles.deckArea}>
                <DecisionDeck
                  items={highPending}
                  onConfirm={handleConfirmItem}
                  onReject={(item) => { haptics.warning(); discardCandidate(db, item.decision.id); }}
                  onEdit={(item) => setEditTarget({ item, confirm: true })}
                  onShowPast={(item) => setPastItems(item.similarPast ?? [])}
                />
              </View>
            ) : (
              <EmptyState
                icon="deck"
                title="확신 높은 후보는 없어요"
                hint="위 '낮은 확신 후보'를 펼쳐 확인하세요."
              />
            )}
          </View>
        ) : (
          <EmptyState
            icon="deck"
            title="검토할 새 후보가 없어요"
            hint="AI가 결정을 추출하면 여기에 나타납니다."
          />
        )
      )}

      {/* 보드 모드 — 진행 중 todo + 완료(회고) + 후속 확인 */}
      {!loading && showBoard && (
        hasBoard ? (
          <KeyboardAvoidingView behavior="padding" style={styles.flex}>
            <ScrollView
              contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.lg }]}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={async () => {
                    setRefreshing(true);
                    haptics.tap();
                    await loadInbox(db);
                    setRefreshing(false);
                  }}
                  tintColor={colors.brand.primary}
                  colors={[colors.brand.primary]}
                />
              }
            >
              {totalDeliberating > 0 && (
                <>
                  <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
                    고민 중 · {totalDeliberating}건
                  </AppText>
                  {deliberatingDecisions.map((item, i) => (
                    <AppearIn key={item.decision.id} index={i}>
                      <DeliberatingCard
                        decision={item.decision}
                        onDecide={() => handleDecideDeliberating(item)}
                        onDiscard={() => { haptics.warning(); discardDeliberating(db, item.decision.id); }}
                      />
                    </AppearIn>
                  ))}
                </>
              )}
              {totalDue > 0 && (
                <>
                  <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
                    후속 확인 · {totalDue}건
                  </AppText>
                  {dueFollowUps.map((item, i) => (
                    <AppearIn key={item.decision.id} index={i}>
                      <FollowUpCard
                        decision={item.decision}
                        onResult={(r) => handleRecordOutcome(item.decision.id, r)}
                        onMemo={() => toggleExpand(item.decision.id)}
                      />
                      {expandedId === item.decision.id && (
                        <OutcomeEditor
                          decision={item.decision}
                          onSubmit={(result, reflection, learnings) => handleOutcome(item.decision.id, result, reflection, learnings)}
                          onVideo={() => handleOutcomeVideo(item.decision.id)}
                          onCancel={() => setExpandedId(null)}
                        />
                      )}
                    </AppearIn>
                  ))}
                </>
              )}
              {totalUpcoming > 0 && (
                <>
                  <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
                    진행 중 · {totalUpcoming}건
                  </AppText>
                  {upcomingDecisions.map((item, i) => (
                    <AppearIn key={item.decision.id} index={i}>
                      <DecisionBoardCard
                        decision={item.decision}
                        entry={item.entry}
                        onCheck={() => markExecuted(db, item.decision.id)}
                        onResult={(r) => handleRecordOutcome(item.decision.id, r)}
                        onPress={() => setEditTarget({ item, confirm: false })}
                        onLongPress={() => setActionTarget(item)}
                      />
                    </AppearIn>
                  ))}
                </>
              )}
              {totalReflection > 0 && (
                <>
                  <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
                    완료 · {totalReflection}건 (체크 취소·결과 기록 가능)
                  </AppText>
                  {reflectionDecisions.map((item, i) => (
                    <AppearIn key={item.decision.id} index={i}>
                      <DecisionDoneRow
                        decision={item.decision}
                        onUncheck={() => unmarkExecuted(db, item.decision.id)}
                        onRecord={() => toggleExpand(item.decision.id)}
                      />
                      {expandedId === item.decision.id && (
                        <OutcomeEditor
                          decision={item.decision}
                          onSubmit={(result, reflection, learnings) => handleOutcome(item.decision.id, result, reflection, learnings)}
                          onVideo={() => handleOutcomeVideo(item.decision.id)}
                          onCancel={() => setExpandedId(null)}
                        />
                      )}
                    </AppearIn>
                  ))}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <EmptyState
            icon="done"
            title="진행 중인 결정이 없어요"
            hint="결정을 컨펌하면 여기 todo로 모입니다."
          />
        )
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

      {decideTarget?.stage === 'past' && (
        <PastDecisionsSheet
          items={decideTarget.similarPast}
          onClose={() => setDecideTarget((d) => (d ? { ...d, stage: 'edit' } : null))}
        />
      )}
      {decideTarget?.stage === 'edit' && (
        <EditDecisionSheet
          key={`decide-${decideTarget.item.decision.id}`}
          visible
          decision={decideTarget.item.decision}
          onCancel={() => setDecideTarget(null)}
          onSave={async (edits) => {
            const t = decideTarget;
            setDecideTarget(null);
            await decideDeliberating(db, t.item.decision.id, edits);
            await obsidianPrompt(t.item.entry.recordedAt);
          }}
        />
      )}

      {editTarget && (
        <EditDecisionSheet
          key={editTarget.item.decision.id}
          visible
          decision={editTarget.item.decision}
          onCancel={() => setEditTarget(null)}
          onSave={async (edits) => {
            const { item, confirm } = editTarget;
            setEditTarget(null);
            if (confirm) {
              await confirmDecision(db, item.decision.id, edits);
              await obsidianPrompt(item.entry.recordedAt);
            } else {
              await editDecision(db, item.decision.id, edits);
            }
          }}
        />
      )}

      <ActionSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        items={boardActions}
        title="결정"
      />
    </ScreenBackground>
  );
}

function EmptyState(
  { icon, title, hint }: {
    icon: IconName;
    title: string;
    hint: string;
  },
) {
  return (
    <View style={styles.empty}>
      <IllustrationSlot name={`inbox-${icon}`} placeholder={<EmptyInboxArt />} size={150} />
      <AppText preset="titleMedium">{title}</AppText>
      <AppText preset="bodyMedium" color={colors.text.tertiary}>{hint}</AppText>
    </View>
  );
}

// 주 토글 — 현재 todo(보드) ↔ 전체 목록. (검토 덱은 헤더의 배지 버튼으로 분리)
function ViewToggle({ mode, onChange }: { mode: InboxViewMode; onChange: (m: InboxViewMode) => void }) {
  return (
    <View style={styles.toggle}>
      <Pressable
        onPress={() => onChange('board')}
        style={[styles.toggleBtn, mode === 'board' && styles.toggleActive]}
        accessibilityLabel="현재 todo"
      >
        <AppText preset="caption" color={mode === 'board' ? colors.brand.onPrimary : colors.text.secondary}>현재 todo</AppText>
      </Pressable>
      <Pressable
        onPress={() => onChange('list')}
        style={[styles.toggleBtn, mode === 'list' && styles.toggleActive]}
        accessibilityLabel="전체 목록"
      >
        <AppText preset="caption" color={mode === 'list' ? colors.brand.onPrimary : colors.text.secondary}>전체 목록</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewBtn: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  reviewBtnOn: { backgroundColor: colors.brand.primary },
  reviewBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: radius.pill, paddingHorizontal: 3,
    backgroundColor: colors.accent.pin, alignItems: 'center', justifyContent: 'center',
  },

  toggle: { flexDirection: 'row', backgroundColor: colors.surface.sunken, borderRadius: radius.pill, padding: spacing.xs, gap: spacing.xs },
  toggleBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  toggleActive: { backgroundColor: colors.brand.primary },

  loader: { marginTop: spacing['4xl'] },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },

  deckArea: { flex: 1, paddingHorizontal: layout.screenPaddingX },
  lowWrap: { paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing.sm },
  list: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.md },
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.sm },
});
