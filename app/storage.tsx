/** @codemap 용량 관리(/storage) — 통계 대시보드 + 월별 zip 내보내기 + 파일 관리 진입
 *  데이터: @/db(getAllMediaEntries) · @/components/SettingsStats · services/video/exportMonthZip
 *  파일 목록·다중선택·일괄관리는 /storage-files로 분리.
 */
import { Icon } from '@/components/ui';
import { format } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SettingsStats } from '@/components/SettingsStats';
import { AppText, Button, Receipt, ScreenBackground } from '@/components/ui';
import { getAllMediaEntries } from '@/db';
import { exportMonthZip } from '@/services/video/exportMonthZip';
import { colors, iconSize, layout, spacing } from '@/theme';

export default function StorageScreen() {
  const db = useSQLiteContext();
  const [months, setMonths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    (async () => {
      const list = await getAllMediaEntries(db);
      const set = new Set<string>();
      for (const e of list) set.add(format(new Date(e.recordedAt), 'yyyy-MM'));
      if (mounted) setMonths([...set].sort().reverse());
    })();
    return () => { mounted = false; };
  }, [db]));

  const exportMonth = useCallback(async (month: string) => {
    setBusy(true);
    try {
      await exportMonthZip(month);
    } catch (e) {
      Alert.alert('내보내기 실패', String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.sm} style={styles.navBtn}>
          <Icon name="back" size={iconSize.lg} color={colors.text.primary} />
        </Pressable>
        <AppText preset="titleMedium" style={styles.headerTitle}>용량 관리</AppText>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <SettingsStats />

        {/* 파일 관리 진입 — 영수증 */}
        <Receipt>
          <Pressable onPress={() => router.push('/storage-files')} style={styles.navRow}>
            <View style={styles.flex}>
              <AppText preset="bodyLarge" color={colors.text.primary}>파일 관리</AppText>
              <AppText preset="caption" color={colors.text.secondary}>
                단계·백업 상태별 조회 · 다중 선택 · 일괄 압축/백업/정리
              </AppText>
            </View>
            <Icon name="forward" size={iconSize.md} color={colors.text.primary} />
          </Pressable>
        </Receipt>

        {/* 월별 백업(zip) — 영수증 */}
        {months.length > 0 && (
          <Receipt>
            <View style={styles.section}>
              <AppText preset="titleMedium" color={colors.text.primary} style={styles.title}>월별 백업 (zip)</AppText>
              <View style={styles.monthList}>
                {months.map((m) => (
                  <View key={m} style={styles.monthRow}>
                    <AppText preset="bodyMedium" color={colors.text.primary} style={styles.flex}>{m}</AppText>
                    <Button label="zip 내보내기" variant="stamp" size="sm" disabled={busy} onPress={() => exportMonth(m)} />
                  </View>
                ))}
              </View>
              <AppText preset="caption" color={colors.text.secondary}>
                그 달의 영상·압축본·썸네일을 하나의 zip으로 묶어 공유 시트로 내보냅니다.
              </AppText>
            </View>
          </Receipt>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
  },
  navBtn: { width: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing['4xl'], gap: spacing.lg },
  flex: { flex: 1 },
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingTop: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg,
  },
  section: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg },
  title: { marginTop: spacing.xs },
  monthList: { gap: spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
