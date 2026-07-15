/** @codemap 결정 탭(/decisions) — 통계(상시) + 보드(고민 중·진행 중·회고 대기) + 전체 기록
 *  데이터: stats(getDecisionPerformance)·decisions·outcomes(@/db) · 상태 stores/inbox · 보드 components/decision/DecisionBoard
 *  관련 ADR: 017(수행/회고), 028(미결). Inbox에서 이관(I2) — store(useInboxStore) 공유.
 */
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { DecisionBoard } from '@/components/decision/DecisionBoard';
import { DecisionList } from '@/components/decision/DecisionList';
import { DecisionStats } from '@/components/decision/DecisionStats';
import { DecisionOnThisDay, type DecisionOnThisDayItem } from '@/components/decision/DecisionOnThisDay';
import { AppText, Highlight, ScreenBackground } from '@/components/ui';
import { getDecisionPerformance, getDecisionsOnThisDay, getOutcomeByDecision } from '@/db';
import type { DecisionPerformance } from '@/db';
import { haptics } from '@/lib/haptics';
import { nowMs } from '@/lib/time';
import { useInboxStore } from '@/stores/inbox';
import { colors, layout, spacing } from '@/theme';

export default function DecisionsScreen() {
  const db = useSQLiteContext();
  const { upcomingDecisions, reflectionDecisions, deliberatingDecisions, loadInbox } = useInboxStore();
  const [performance, setPerformance] = useState<DecisionPerformance | null>(null);
  const [onThisDay, setOnThisDay] = useState<DecisionOnThisDayItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  const loadInsights = useCallback(async () => {
    try {
      const [perf, otd] = await Promise.all([
        getDecisionPerformance(db),
        getDecisionsOnThisDay(db, nowMs()),
      ]);
      const otdItems = await Promise.all(
        otd.map(async (decision) => ({ decision, outcome: await getOutcomeByDecision(db, decision.id) })),
      );
      setPerformance(perf);
      setOnThisDay(otdItems);
    } catch (e) {
      console.error('[decisions] insights load failed', e);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { loadInbox(db); loadInsights(); }, [db, loadInbox, loadInsights]));

  // I2: 결정 탭 '고민 중'은 미도래 미결(마감 없음 또는 미래). 마감 도래분은 Inbox.
  const now = nowMs();
  const deliberatingNotDue = deliberatingDecisions.filter(
    (i) => i.decision.decideBy == null || i.decision.decideBy > now,
  );

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Highlight vary="decisions-title">
          <AppText preset="displayCompact">결정</AppText>
        </Highlight>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              haptics.tap();
              await Promise.all([loadInbox(db), loadInsights()]);
              setRefreshing(false);
            }}
            tintColor={colors.brand.primary}
            colors={[colors.brand.primary]}
          />
        }
      >
        {performance && (
          <View style={styles.statsWrap}>
            <AppText preset="caption" color={colors.text.tertiary}>회고 대시보드</AppText>
            <DecisionStats performance={performance} />
          </View>
        )}

        <DecisionOnThisDay items={onThisDay} onPress={(d) => router.push(`/decision/${d.id}`)} />

        <DecisionBoard
          deliberating={deliberatingNotDue}
          dueFollowUps={[]}
          upcoming={upcomingDecisions}
          reflection={reflectionDecisions}
        />

        <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>전체 기록</AppText>
        <DecisionList />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.sm },
  statsWrap: { gap: spacing.xs, marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
