/** @codemap 인박스 탭(/inbox) — AI 추출 Decision 컨펌(스와이프덱/리스트 2모드)
 *  데이터: getSettings(@/db) · 상태 stores/inbox · 관련 ADR: 006(컨펌), 016(AI 원본 보존)
 */
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DecisionCard } from '@/components/DecisionCard';
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
    pendingCandidates, dueFollowUps, loading, viewMode, setViewMode,
    loadInbox, confirmDecision, rejectDecision, recordOutcome,
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
  const hasItems = totalPending + totalDue > 0;
  const showDeck = viewMode === 'deck' && totalPending > 0;

  const followUpSection = totalDue > 0 && (
    <>
      <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
        후속 확인 · {totalDue}건
      </AppText>
      {dueFollowUps.map(({ decision }) => (
        <FollowUpCard key={decision.id} decision={decision} onResult={(r) => recordOutcome(db, decision.id, r)} />
      ))}
    </>
  );

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <AppText preset="displayLarge">Inbox</AppText>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </View>
        {hasItems && (
          <AppText preset="caption" color={colors.text.secondary}>
            검토 대기 {totalPending}건 · 후속 확인 {totalDue}건
          </AppText>
        )}
      </View>

      {loading && <ActivityIndicator style={styles.loader} color={colors.brand.primary} />}

      {!loading && !hasItems && (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.text.tertiary} />
          <AppText preset="titleMedium">할 일이 없어요</AppText>
          <AppText preset="bodyMedium" color={colors.text.tertiary}>AI가 결정을 추출하면 여기에 나타납니다.</AppText>
        </View>
      )}

      {!loading && hasItems && (
        showDeck ? (
          <View style={[styles.deckArea, { paddingBottom: tabBarHeight }]}>
            <DecisionDeck
              items={pendingCandidates}
              onConfirm={handleConfirmItem}
              onReject={(item) => rejectDecision(db, item.decision.id)}
              onEdit={(item) => setEditingItem(item)}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.lg }]}>
            {followUpSection}
            {totalPending > 0 && (
              <>
                <AppText preset="caption" color={colors.text.secondary} style={styles.sectionTitle}>
                  검토 대기 · {totalPending}건
                </AppText>
                {pendingCandidates.map((item) => (
                  <DecisionCard
                    key={item.decision.id}
                    decision={item.decision}
                    entry={item.entry}
                    onConfirm={() => handleConfirmItem(item)}
                    onReject={() => rejectDecision(db, item.decision.id)}
                    onEdit={() => setEditingItem(item)}
                  />
                ))}
              </>
            )}
          </ScrollView>
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

function ViewToggle({ mode, onChange }: { mode: InboxViewMode; onChange: (m: InboxViewMode) => void }) {
  return (
    <View style={styles.toggle}>
      <Pressable
        onPress={() => onChange('deck')}
        style={[styles.toggleBtn, mode === 'deck' && styles.toggleActive]}
      >
        <Ionicons name="albums-outline" size={iconSize.md} color={mode === 'deck' ? colors.brand.onPrimary : colors.text.secondary} />
      </Pressable>
      <Pressable
        onPress={() => onChange('list')}
        style={[styles.toggleBtn, mode === 'list' && styles.toggleActive]}
      >
        <Ionicons name="list-outline" size={iconSize.md} color={mode === 'list' ? colors.brand.onPrimary : colors.text.secondary} />
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
