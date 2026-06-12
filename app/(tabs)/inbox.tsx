import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DecisionCard } from '@/components/DecisionCard';
import { EditDecisionSheet } from '@/components/EditDecisionSheet';
import { FollowUpCard } from '@/components/FollowUpCard';
import { getSettings } from '@/db';
import { openEntryInObsidian } from '@/lib/obsidian';
import { useInboxStore, type DecisionWithEntry } from '@/stores/inbox';
import type { Decision } from '@/types/domain';

export default function InboxScreen() {
  const db = useSQLiteContext();
  const {
    pendingCandidates,
    dueFollowUps,
    loading,
    loadInbox,
    confirmDecision,
    rejectDecision,
    recordOutcome,
  } = useInboxStore();

  const [editingItem, setEditingItem] = useState<DecisionWithEntry | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadInbox(db);
    }, [db, loadInbox]),
  );

  const handleConfirmItem = useCallback(async (item: DecisionWithEntry) => {
    await confirmDecision(db, item.decision.id);
    const settings = await getSettings(db);
    if (settings.obsidianVaultUri) {
      Alert.alert(
        '결정 확정됨',
        '잠시 후 옵시디언 노트에 반영됩니다.',
        [
          { text: '닫기', style: 'cancel' },
          {
            text: '옵시디언에서 열기',
            onPress: () => openEntryInObsidian(db, item.entry.recordedAt),
          },
        ],
      );
    }
  }, [db, confirmDecision]);

  const totalPending = pendingCandidates.length;
  const totalDue = dueFollowUps.length;
  const hasItems = totalPending + totalDue > 0;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        {hasItems && (
          <Text style={styles.subtitle}>
            검토 대기 {totalPending}건 · 후속 확인 {totalDue}건
          </Text>
        )}
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#999" />}

      {!loading && !hasItems && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>할 일이 없어요</Text>
          <Text style={styles.emptyDesc}>AI가 결정을 추출하면 여기에 나타납니다.</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {totalDue > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>후속 확인 · {totalDue}건</Text>
            </View>
            {dueFollowUps.map(({ decision }) => (
              <FollowUpCard
                key={decision.id}
                decision={decision}
                onResult={(result) => recordOutcome(db, decision.id, result)}
              />
            ))}
          </>
        )}

        {totalPending > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>검토 대기 · {totalPending}건</Text>
            </View>
            {pendingCandidates.map((item) => (
              <DecisionCard
                key={item.decision.id}
                decision={item.decision}
                onConfirm={() => handleConfirmItem(item)}
                onReject={() => rejectDecision(db, item.decision.id)}
                onEdit={() => setEditingItem(item)}
              />
            ))}
          </>
        )}
      </ScrollView>

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
            const settings = await getSettings(db);
            if (settings.obsidianVaultUri) {
              Alert.alert(
                '결정 확정됨',
                '잠시 후 옵시디언 노트에 반영됩니다.',
                [
                  { text: '닫기', style: 'cancel' },
                  {
                    text: '옵시디언에서 열기',
                    onPress: () => openEntryInObsidian(db, item.entry.recordedAt),
                  },
                ],
              );
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f7' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  loader: { marginTop: 40 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 40, color: '#ccc' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  emptyDesc: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },

  list: { paddingVertical: 10, paddingBottom: 32 },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase' },
});
