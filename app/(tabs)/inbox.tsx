/** @codemap 인박스 탭(/inbox) — AI 추출 컨펌(덱) + 결정 보드(진행 중 todo · 후속 확인)
 *  데이터: getSettings(@/db) · 상태 stores/inbox · 관련 ADR: 006(컨펌), 016(원본 보존), 017(후속/수행)
 */
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DecisionBoardCard } from '@/components/DecisionBoardCard';
import { DecisionDeck } from '@/components/DecisionDeck';
import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { FollowUpCard } from '@/components/FollowUpCard';
import { AppText, ScreenBackground } from '@/components/ui';
import { getSettings } from '@/db';
import { openEntryInObsidian } from '@/lib/obsidian';
import { useInboxStore, type DecisionWithEntry, type InboxViewMode } from '@/stores/inbox';
import { colors, iconSize, layout, radius, spacing } from '@/theme';

export default function InboxScreen() {
  const db = useSQLiteContext();
  const {
    pendingCandidates, dueFollowUps, upcomingDecisions, loading, viewMode, setViewMode,
    loadInbox, confirmDecision, rejectDecision, recordOutcome, markExecuted,
  } = useInboxStore();

  const [editingItem, setEditingItem] = useState<DecisionWithEntry | null>(null);
  const tabBarHeight = useBottomTabBarHeight();

  useFocusEffect(useCallback(() => { loadInbox(db); }, [db, loadInbox]));

  const obsidianPrompt = useCallback(async (recordedAt: number) => {
    const settings = await getSettings(db);
    if (!settings.obsidianVaultUri) return;
    Alert.alert('결정 확정됨', '잠시 후 옵시디언 노트에 반영됩니다.', [
      { text: '닫기', style: 'cancel' },
      { text: '옵시디언에서 열기', onPress: () => openEntryInObsidian(db, recordedAt) },
    ]);
  }, [db]);

  const handleConfirmItem = useCallback(async (item: DecisionWithEntry) => {
    await confirmDecision(db, item.decision.id);
    await obsidianPrompt(item.entry.recordedAt);
  }, [db, confirmDecision, obsidianPrompt]);

  const totalPending = pendingCandidates.length;
  const totalDue = dueFollowUps.length;
  const totalUpcoming = upcomingDecisions.length;
  const showDeck = viewMode === 'deck';

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <AppText preset="displayLarge">Inbox</AppText>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </View>
        <AppText preset="caption" color={colors.text.secondary}>
          {showDeck
            ? `검토 대기 ${totalPending}건`
            : `진행 중 ${totalUpcoming}건 · 후속 확인 ${totalDue}건`}
        </AppText>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color={colors.brand.primary} />}

      {/* 덱 모드 — AI 추출 후보 컨펌 */}
      {!loading && showDeck && (
        totalPending > 0 ? (
          <View style={[styles.deckArea, { paddingBottom: tabBarHeight }]}>
            <DecisionDeck
              items={pendingCandidates}
              onConfirm={handleConfirmItem}
              onReject={(item) => rejectDecision(db, item.decision.id)}
              onEdit={(item) => setEditingItem(item)}
            />
          </View>
        ) : (
          <EmptyState
            icon="albums-outline"
            title="검토할 새 후보가 없어요"
            hint="AI가 결정을 추출하면 여기에 나타납니다."
          />
        )
      )}

      {/* 보드 모드 — 후속 확인 + 진행 중 todo */}
      {!loading && !showDeck && (
        totalDue + totalUpcoming > 0 ? (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.lg }]}>
            {totalDue > 0 && (
              <>
                <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
                  후속 확인 · {totalDue}건
                </AppText>
                {dueFollowUps.map(({ decision }) => (
                  <FollowUpCard
                    key={decision.id}
                    decision={decision}
                    onResult={(r) => recordOutcome(db, decision.id, r)}
                  />
                ))}
              </>
            )}
            {totalUpcoming > 0 && (
              <>
                <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
                  진행 중 · {totalUpcoming}건
                </AppText>
                {upcomingDecisions.map((item) => (
                  <DecisionBoardCard
                    key={item.decision.id}
                    decision={item.decision}
                    entry={item.entry}
                    onCheck={() => markExecuted(db, item.decision.id)}
                    onPress={() => router.push(`/entry/${item.entry.id}`)}
                  />
                ))}
              </>
            )}
          </ScrollView>
        ) : (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="진행 중인 결정이 없어요"
            hint="결정을 컨펌하면 여기 todo로 모입니다."
          />
        )
      )}

      {editingItem && (
        <EditDecisionSheet
          key={editingItem.decision.id}
          visible
          decision={editingItem.decision}
          onCancel={() => setEditingItem(null)}
          onSave={async (edits) => {
            const item = editingItem;
            setEditingItem(null);
            await confirmDecision(db, item.decision.id, edits);
            await obsidianPrompt(item.entry.recordedAt);
          }}
        />
      )}
    </ScreenBackground>
  );
}

function EmptyState(
  { icon, title, hint }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    hint: string;
  },
) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={48} color={colors.text.tertiary} />
      <AppText preset="titleMedium">{title}</AppText>
      <AppText preset="bodyMedium" color={colors.text.tertiary}>{hint}</AppText>
    </View>
  );
}

function ViewToggle({ mode, onChange }: { mode: InboxViewMode; onChange: (m: InboxViewMode) => void }) {
  return (
    <View style={styles.toggle}>
      <Pressable
        onPress={() => onChange('deck')}
        style={[styles.toggleBtn, mode === 'deck' && styles.toggleActive]}
        accessibilityLabel="컨펌 덱"
      >
        <Ionicons name="albums-outline" size={iconSize.md} color={mode === 'deck' ? colors.brand.onPrimary : colors.text.secondary} />
      </Pressable>
      <Pressable
        onPress={() => onChange('board')}
        style={[styles.toggleBtn, mode === 'board' && styles.toggleActive]}
        accessibilityLabel="결정 보드"
      >
        <Ionicons name="checkbox-outline" size={iconSize.md} color={mode === 'board' ? colors.brand.onPrimary : colors.text.secondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  toggle: { flexDirection: 'row', backgroundColor: colors.surface.sunken, borderRadius: radius.pill, padding: spacing.xs, gap: spacing.xs },
  toggleBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  toggleActive: { backgroundColor: colors.brand.primary },

  loader: { marginTop: spacing['4xl'] },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },

  deckArea: { flex: 1, paddingHorizontal: layout.screenPaddingX },
  list: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.md },
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.sm },
});
