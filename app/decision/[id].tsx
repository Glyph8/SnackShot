/** @codemap 결정 상세(/decision/:id) — 헤더칩·상황/이유/매매·유사과거 상시·연관·회고 타임라인
 *  데이터: @/db(decisions·outcomes·decisionLinks·entries) · 편집 EditDecisionSheet · 미결전이 stores/inbox
 *  관련 ADR: 016(원본 보존), 017(후속), 028(미결). 진입점: 목록·보드·검색 카드 탭.
 */
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { PastDecisionsSheet } from '@/components/decision/PastDecisionsSheet';
import { DecisionDetailHeader } from '@/components/decision/detail/DecisionDetailHeader';
import { DecisionDetailBody } from '@/components/decision/detail/DecisionDetailBody';
import { SimilarPastSection } from '@/components/decision/detail/SimilarPastSection';
import { OutcomeTimeline } from '@/components/decision/detail/OutcomeTimeline';
import { AppText, Button, Icon, ScreenBackground } from '@/components/ui';
import {
  enqueueJob, getDecision, getEntry, getOutcomeByDecision, getOutcomeHistory,
  getRelatedDecisions, getSettings, getSimilarPastDecisions, updateUserEdit,
} from '@/db';
import type { RelatedDecision, SimilarPastItem } from '@/db';
import { openEntryInObsidian } from '@/lib/obsidian';
import { syncFollowUpForDecision } from '@/services/followUpNotifications';
import { kickWorker } from '@/services/jobs/queue';
import { useInboxStore, type EditParams } from '@/stores/inbox';
import { colors, iconSize, layout, spacing } from '@/theme';
import type { Decision, Entry, Outcome } from '@/types/domain';

type RelatedWithOutcome = RelatedDecision & { outcome: Outcome | null };

export default function DecisionDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [decision, setDecision] = useState<Decision | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [related, setRelated] = useState<RelatedWithOutcome[]>([]);
  const [similarPast, setSimilarPast] = useState<SimilarPastItem[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [editing, setEditing] = useState(false);
  // 미결 "결정했다" 플로우: 과거 개입(F1) → 편집 시트 (inbox와 동일 UX)
  const [decideStage, setDecideStage] = useState<'past' | 'edit' | null>(null);

  const load = useCallback(async () => {
    const d = await getDecision(db, id);
    if (!d) { router.back(); return; }
    setDecision(d);
    setEntry(await getEntry(db, d.entryId));
    const rel = await getRelatedDecisions(db, d.id);
    setRelated(await Promise.all(
      rel.map(async (r) => ({ ...r, outcome: await getOutcomeByDecision(db, r.decision.id) })),
    ));
    const q = d.userSummary ?? d.summary;
    setSimilarPast(await getSimilarPastDecisions(db, q, { excludeEntryId: d.entryId, limit: 5 }));
    setOutcomes(await getOutcomeHistory(db, d.id));
  }, [db, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 내용 변경 시 vault 재export (inbox editDecision 선례와 동일 — 자동내보내기 설정 시).
  const reExport = useCallback(async (entryId: string) => {
    const s = await getSettings(db);
    if (!s.obsidianVaultUri) return;
    await enqueueJob(db, 'obsidian_export', entryId, 'entries');
    kickWorker();
  }, [db]);

  const obsidianPrompt = useCallback(async (recordedAt: number) => {
    const s = await getSettings(db);
    if (!s.obsidianVaultUri) return;
    Alert.alert('결정 확정됨', '잠시 후 옵시디언 노트에 반영됩니다.', [
      { text: '닫기', style: 'cancel' },
      { text: '옵시디언에서 열기', onPress: () => openEntryInObsidian(db, recordedAt) },
    ]);
  }, [db]);

  const handleEditSave = useCallback(async (edits: EditParams) => {
    setEditing(false);
    await updateUserEdit(db, id, {
      ...edits,
      followUpSetBy: edits.followUpAt !== undefined ? 'user' : undefined,
    });
    await syncFollowUpForDecision(db, id);
    if (entry) await reExport(entry.id);
    await load();
  }, [db, id, entry, reExport, load]);

  // 미결→확정 "결정했다" — inbox의 store 플로우 재사용. 보드 state에 항목이 있어야 재export가
  // 걸리므로(decideDeliberating 내부 로직) loadInbox로 state를 채운 뒤 호출한다.
  const startDecide = useCallback(() => {
    setDecideStage(similarPast.length > 0 ? 'past' : 'edit');
  }, [similarPast.length]);

  const handleDecideSave = useCallback(async (edits: EditParams) => {
    setDecideStage(null);
    const store = useInboxStore.getState();
    await store.loadInbox(db);
    await store.decideDeliberating(db, id, edits);
    await load();
    if (entry) await obsidianPrompt(entry.recordedAt);
  }, [db, id, entry, load, obsidianPrompt]);

  if (!decision) return <ScreenBackground edges={['top']}><View style={styles.flex} /></ScreenBackground>;

  const dateMs = decision.confirmedAt ?? decision.extractedAt;

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.sm} style={styles.navBtn}>
          <Icon name="back" size={iconSize.lg} color={colors.text.primary} />
        </Pressable>
        <AppText preset="titleMedium" numberOfLines={1} style={styles.headerTitle}>
          {format(new Date(dateMs), 'M월 d일', { locale: ko })} 결정
        </AppText>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <DecisionDetailHeader decision={decision} />

        {decision.status === 'deliberating' && (
          <Button label="결정했다 ✓" variant="primary" onPress={startDecide} fullWidth style={styles.decideBtn} />
        )}

        <DecisionDetailBody
          decision={decision}
          related={related}
          hasOriginal={!!entry}
          onOpenOriginal={() => entry && router.push(`/entry/${entry.id}`)}
          // 미결은 수정 숨김 — updateUserEdit(status='edited')로 미결이 확정 오염되는 것 방지.
          // 미결의 내용 정리는 "결정했다" 전이 시트에서 한다.
          onEdit={decision.status === 'deliberating' ? undefined : () => setEditing(true)}
          onPressRelated={(rid) => router.push(`/decision/${rid}`)}
        />

        <View style={styles.divider} />
        <SimilarPastSection items={similarPast} onPressItem={(sid) => router.push(`/decision/${sid}`)} />

        <View style={styles.divider} />
        <OutcomeTimeline decision={decision} outcomes={outcomes} />
      </ScrollView>

      {editing && (
        <EditDecisionSheet
          key={`edit-${decision.id}`}
          visible
          decision={decision}
          onCancel={() => setEditing(false)}
          onSave={handleEditSave}
        />
      )}

      {decideStage === 'past' && (
        <PastDecisionsSheet
          items={similarPast}
          onClose={() => setDecideStage('edit')}
        />
      )}
      {decideStage === 'edit' && (
        <EditDecisionSheet
          key={`decide-${decision.id}`}
          visible
          decision={decision}
          onCancel={() => setDecideStage(null)}
          onSave={handleDecideSave}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
  },
  navBtn: { width: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing['4xl'], gap: spacing.lg },
  decideBtn: { marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border.card },
});
