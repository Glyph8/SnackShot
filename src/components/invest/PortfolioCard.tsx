import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import type { PortfolioSnapshot } from '@/services/trade/portfolio';
import type { PortfolioValuation } from '@/services/trade/valuation';
import { colors, spacing } from '@/theme';

// I3(c)1: 포트폴리오 카드 — 최신 스냅샷 평가액(캐시 우선 종가 합, 폴백 캡처값). 없으면 캡처 시작 안내.
//   갱신 = portfolio-import 재진입(캡처가 진실원, H3). H0: 열람실 — 주문·추천 없음.

function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

interface Props {
  snapshot: PortfolioSnapshot | null;
  valuation: PortfolioValuation | null;
  onImport(): void;
}

export function PortfolioCard({ snapshot, valuation, onImport }: Props) {
  if (!snapshot) {
    return (
      <Card style={styles.card}>
        <AppText preset="titleMedium">아직 포트폴리오가 없어요</AppText>
        <AppText preset="bodyMedium" color={colors.text.secondary}>
          증권앱 화면을 캡처하면 보유 종목을 불러옵니다.
        </AppText>
        <Button label="📷 캡처로 시작" onPress={onImport} fullWidth style={styles.btn} />
      </Card>
    );
  }

  const missing = valuation?.missingNames ?? [];
  return (
    <Card style={styles.card}>
      <AppText preset="caption" color={colors.text.tertiary}>평가액</AppText>
      <AppText preset="displayCompact">{valuation ? won(valuation.total) : '—'}</AppText>
      <AppText preset="caption" color={colors.text.tertiary}>
        {`${snapshot.holdings.length}개 종목 · ${format(new Date(snapshot.createdAt), 'yyyy. M. d', { locale: ko })} 캡처`}
      </AppText>
      {missing.length > 0 && (
        <AppText preset="caption" color={colors.feedback.warning}>
          {`시세·평가값이 없어 제외: ${missing.join(', ')}`}
        </AppText>
      )}
      <Button label="🔄 갱신 (캡처)" variant="secondary" size="sm" onPress={onImport} fullWidth style={styles.btn} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  btn: { marginTop: spacing.sm },
});
