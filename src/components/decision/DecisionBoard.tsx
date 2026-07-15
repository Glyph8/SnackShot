import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { DecisionBoardCard } from '@/components/DecisionBoardCard';
import { DecisionDoneRow } from '@/components/DecisionDoneRow';
import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { FollowUpCard } from '@/components/FollowUpCard';
import { OutcomeEditor } from '@/components/OutcomeEditor';
import { DeliberatingCard } from '@/components/inbox/DeliberatingCard';
import { PastDecisionsSheet } from '@/components/decision/PastDecisionsSheet';
import { ActionSheet, type ActionItem, AppearIn, AppText } from '@/components/ui';
import { getSettings, getSimilarPastDecisions } from '@/db';
import type { SimilarPastItem } from '@/db';
import { haptics } from '@/lib/haptics';
import { openEntryInObsidian } from '@/lib/obsidian';
import { useInboxStore, type DecisionWithEntry } from '@/stores/inbox';
import type { OutcomeResult } from '@/types/domain';
import { colors, spacing } from '@/theme';

// I2: 결정 보드 섹션(고민 중·후속 확인·진행 중·완료) + 처리 핸들러·모달을 Inbox에서 추출.
//   Inbox(마감 도래 미결·후속 도래)와 결정 탭(미도래 미결·진행 중·회고 대기)이 store를 공유하며 재사용.
//   스크롤 컨테이너는 부모가 소유(중첩 스크롤 방지) — 여기선 섹션 + 모달만 렌더한다.
//   빠른 액션(체크·결과 이모지·롱프레스)은 카드에 유지, 카드 본문 탭 = 결정 상세(I1).

interface Props {
  deliberating: DecisionWithEntry[];
  dueFollowUps: DecisionWithEntry[];
  upcoming: DecisionWithEntry[];
  reflection: DecisionWithEntry[];
}

export function DecisionBoard({ deliberating, dueFollowUps, upcoming, reflection }: Props) {
  const db = useSQLiteContext();
  const {
    editDecision, rejectDecision, recordOutcome, reFollowDecision,
    decideDeliberating, discardDeliberating, markExecuted, unmarkExecuted,
  } = useInboxStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<DecisionWithEntry | null>(null);
  const [editTarget, setEditTarget] = useState<DecisionWithEntry | null>(null);
  // F5/ADR-028: 미결→확정 "결정했다" 플로우(과거 개입 시트 → 편집 시트)
  const [decideTarget, setDecideTarget] = useState<{ item: DecisionWithEntry; similarPast: SimilarPastItem[]; stage: 'past' | 'edit' } | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const obsidianPrompt = useCallback(async (recordedAt: number) => {
    const settings = await getSettings(db);
    if (!settings.obsidianVaultUri) return;
    Alert.alert('결정 확정됨', '잠시 후 옵시디언 노트에 반영됩니다.', [
      { text: '닫기', style: 'cancel' },
      { text: '옵시디언에서 열기', onPress: () => openEntryInObsidian(db, recordedAt) },
    ]);
  }, [db]);

  // F4: unclear/mixed 결과 직후 "7일 뒤 다시?" 제안. 메모가 있으면 잠정 판단이 아니므로 제안 생략.
  const proposeRefollow = useCallback((id: string, result: OutcomeResult, hasMemo: boolean) => {
    if (result !== 'unclear' && result !== 'mixed') return;
    if (hasMemo) return;
    Alert.alert('결과 기록됨', '아직 판단하기 이르다면 7일 뒤 다시 물어볼까요?', [
      { text: '아니요', style: 'cancel' },
      { text: '7일 뒤 다시', onPress: () => reFollowDecision(db, id) },
    ]);
  }, [db, reFollowDecision]);

  const handleRecordOutcome = useCallback(async (id: string, result: OutcomeResult, reflectionText?: string, learnings?: string) => {
    await recordOutcome(db, id, result, reflectionText, learnings);
    proposeRefollow(id, result, !!(reflectionText?.trim() || learnings?.trim()));
  }, [db, recordOutcome, proposeRefollow]);

  const handleOutcome = useCallback((id: string, result: OutcomeResult, reflectionText?: string, learnings?: string) => {
    setExpandedId(null);
    handleRecordOutcome(id, result, reflectionText, learnings);
  }, [handleRecordOutcome]);

  const handleOutcomeVideo = useCallback((id: string) => {
    setExpandedId(null);
    router.push({ pathname: '/record', params: { decisionId: id } });
  }, []);

  const handleDecideDeliberating = useCallback(async (item: DecisionWithEntry) => {
    let similarPast: SimilarPastItem[] = [];
    try {
      const q = item.decision.userSummary ?? item.decision.summary;
      similarPast = await getSimilarPastDecisions(db, q, { excludeEntryId: item.decision.entryId, limit: 3 });
    } catch (e) {
      console.warn('[board] deliberating similar fetch failed', e);
    }
    setDecideTarget({ item, similarPast, stage: similarPast.length > 0 ? 'past' : 'edit' });
  }, [db]);

  const at = actionTarget;
  const boardActions: ActionItem[] = at ? [
    { label: '수정', icon: 'open', onPress: () => setEditTarget(at) },
    { label: '완료 처리', icon: 'check', onPress: () => markExecuted(db, at.decision.id) },
    { label: '결정 취소', icon: 'trash', destructive: true, onPress: () => { haptics.warning(); rejectDecision(db, at.decision.id); } },
  ] : [];

  return (
    <>
      {deliberating.length > 0 && (
        <>
          <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
            고민 중 · {deliberating.length}건
          </AppText>
          {deliberating.map((item, i) => (
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

      {dueFollowUps.length > 0 && (
        <>
          <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
            후속 확인 · {dueFollowUps.length}건
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
                  onSubmit={(result, reflectionText, learnings) => handleOutcome(item.decision.id, result, reflectionText, learnings)}
                  onVideo={() => handleOutcomeVideo(item.decision.id)}
                  onCancel={() => setExpandedId(null)}
                />
              )}
            </AppearIn>
          ))}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
            진행 중 · {upcoming.length}건
          </AppText>
          {upcoming.map((item, i) => (
            <AppearIn key={item.decision.id} index={i}>
              <DecisionBoardCard
                decision={item.decision}
                entry={item.entry}
                onCheck={() => markExecuted(db, item.decision.id)}
                onResult={(r) => handleRecordOutcome(item.decision.id, r)}
                onPress={() => router.push(`/decision/${item.decision.id}`)}
                onLongPress={() => setActionTarget(item)}
              />
            </AppearIn>
          ))}
        </>
      )}

      {reflection.length > 0 && (
        <>
          <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
            완료 · {reflection.length}건 (체크 취소·결과 기록 가능)
          </AppText>
          {reflection.map((item, i) => (
            <AppearIn key={item.decision.id} index={i}>
              <DecisionDoneRow
                decision={item.decision}
                onUncheck={() => unmarkExecuted(db, item.decision.id)}
                onRecord={() => toggleExpand(item.decision.id)}
              />
              {expandedId === item.decision.id && (
                <OutcomeEditor
                  decision={item.decision}
                  onSubmit={(result, reflectionText, learnings) => handleOutcome(item.decision.id, result, reflectionText, learnings)}
                  onVideo={() => handleOutcomeVideo(item.decision.id)}
                  onCancel={() => setExpandedId(null)}
                />
              )}
            </AppearIn>
          ))}
        </>
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
          key={editTarget.decision.id}
          visible
          decision={editTarget.decision}
          onCancel={() => setEditTarget(null)}
          onSave={async (edits) => {
            const t = editTarget;
            setEditTarget(null);
            await editDecision(db, t.decision.id, edits);
          }}
        />
      )}

      <ActionSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        items={boardActions}
        title="결정"
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.sm },
});
