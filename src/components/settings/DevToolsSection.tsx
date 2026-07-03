import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, ToastAndroid, View } from 'react-native';

import { AppText, Button, CollapsibleSection } from '@/components/ui';
import { getDbStats, purgeTestData, seedTestData } from '@/db';
import {
  cancelAllScheduledNotifications, getScheduledNotificationCount,
  requestNotificationPermission, resyncFollowUpNotifications, scheduleTestNotification,
} from '@/services/followUpNotifications';
import { colors, spacing } from '@/theme';

// ⚠️ 개발/테스트 전용 — 설정 맨 아래 숨은 제스처(하단 텍스트 7탭)로만 열리며 __DEV__ 빌드에서만 마운트된다.
// 시간이 필요한 기능(작년 오늘·실행 지연·후속 알림)을 시드 데이터로 즉시 검증한다.

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert(msg);
}

interface Props {
  db: SQLiteDatabase;
  onAfterMutate?: () => void;
}

export function DevToolsSection({ db, onAfterMutate }: Props) {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = () => run(async () => {
    const r = await seedTestData(db);
    await resyncFollowUpNotifications(db);
    onAfterMutate?.();
    Alert.alert('시드 완료', `결정 ${r.decisions} · 회고 ${r.outcomes} · 링크 ${r.links} · 엔트리 ${r.entries} 추가됨`);
  });

  const handlePurge = () => {
    Alert.alert('테스트 데이터 제거', '시드로 넣은 데이터를 모두 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => run(async () => {
          const r = await purgeTestData(db);
          await resyncFollowUpNotifications(db);
          onAfterMutate?.();
          toast(`결정 ${r.decisions} · 엔트리 ${r.entries} 제거됨`);
        }),
      },
    ]);
  };

  const handleTestNotif = () => run(async () => {
    const ok = await requestNotificationPermission();
    if (!ok) { toast('알림 권한이 없어요'); return; }
    await scheduleTestNotification(10);
    toast('10초 뒤 테스트 알림 예약됨');
  });

  const handleNotifCount = () => run(async () => {
    const n = await getScheduledNotificationCount();
    Alert.alert('예약된 알림', `${n}개`);
  });

  const handleCancelNotif = () => run(async () => {
    await cancelAllScheduledNotifications();
    toast('예약 알림 전체 취소됨');
  });

  const handleResync = () => run(async () => {
    await resyncFollowUpNotifications(db);
    toast('후속 알림 재동기화 완료');
  });

  const handleDbStats = () => run(async () => {
    const s = await getDbStats(db);
    Alert.alert('DB 상태', [
      `스키마 버전: v${s.userVersion}`,
      `엔트리: ${s.entries}`,
      `결정: ${s.decisions}`,
      `회고: ${s.outcomes}`,
      `연관 링크: ${s.decisionLinks}`,
      `전사: ${s.transcripts}`,
    ].join('\n'));
  });

  return (
    <CollapsibleSection title="🛠 개발자 도구" hint="테스트 전용">
      <View style={styles.card}>
        <AppText preset="caption" color={colors.text.tertiary}>
          시드 데이터에는 작년/재작년 오늘 확정된 결정, 회고, 연관 링크, 2분 뒤 후속 알림 후보가 포함됩니다. 제거로 한 번에 정리됩니다.
        </AppText>

        <AppText preset="caption" color={colors.text.secondary}>데이터</AppText>
        <View style={styles.rowButtons}>
          <Button label="테스트 데이터 심기" size="sm" onPress={handleSeed} disabled={busy} style={styles.flex1} />
          <Button label="제거" variant="secondary" size="sm" onPress={handlePurge} disabled={busy} style={styles.flex1} />
        </View>

        <AppText preset="caption" color={colors.text.secondary}>알림</AppText>
        <View style={styles.rowButtons}>
          <Button label="10초 뒤 테스트" size="sm" onPress={handleTestNotif} disabled={busy} style={styles.flex1} />
          <Button label="예약 개수" variant="secondary" size="sm" onPress={handleNotifCount} disabled={busy} style={styles.flex1} />
        </View>
        <View style={styles.rowButtons}>
          <Button label="전체 취소" variant="secondary" size="sm" onPress={handleCancelNotif} disabled={busy} style={styles.flex1} />
          <Button label="재동기화" variant="secondary" size="sm" onPress={handleResync} disabled={busy} style={styles.flex1} />
        </View>

        <AppText preset="caption" color={colors.text.secondary}>진단</AppText>
        <Button label="DB 상태 보기" variant="secondary" size="sm" onPress={handleDbStats} disabled={busy} fullWidth />
      </View>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  rowButtons: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
});
