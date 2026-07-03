/** @codemap 의사결정 모아보기(/decisions) — 처리된 결정 관리(상세 확장·편집·Todo 되돌리기)
 *  본문은 components/decision/DecisionList(Inbox '전체 목록' 탭과 공유). 현재 nav 링크는 없음(직접/딥링크용 라우트로 유지)
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { DecisionList } from '@/components/decision/DecisionList';
import { AppText, Icon, ScreenBackground } from '@/components/ui';
import { colors, iconSize, layout, spacing } from '@/theme';

export default function DecisionsScreen() {
  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.sm} style={styles.navBtn}>
          <Icon name="back" size={iconSize.lg} color={colors.text.primary} />
        </Pressable>
        <AppText preset="titleMedium">의사결정</AppText>
        <View style={styles.navBtn} />
      </View>
      <DecisionList showInsights />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm,
  },
  navBtn: { width: 36, alignItems: 'flex-start' },
});
