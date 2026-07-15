/** @codemap 투자 탭(/invest) — 포트폴리오 평가액·매매 결정 종목·원칙 상시 대조
 *  데이터: @/db(portfolio·decisions) · service trade/{valuation,principleWatch} · obsidian(readUserProfile)
 *  H0: 열람실 — 주문·추천·예측·실시간 없음. 종목 리스트 행 탭 → /stock/[ticker].
 */
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { PortfolioCard } from '@/components/invest/PortfolioCard';
import { PrincipleWatchSection } from '@/components/invest/PrincipleWatchSection';
import { StockDecisionList, type StockDecisionRow } from '@/components/invest/StockDecisionList';
import { AppText, Highlight, ScreenBackground } from '@/components/ui';
import { getLatestPortfolioSnapshot, getTradeDecisionRows } from '@/db';
import { readUserProfile } from '@/services/obsidian';
import type { PortfolioSnapshot } from '@/services/trade/portfolio';
import { runPrincipleWatch, type PrincipleWatchResult } from '@/services/trade/principleWatch';
import { parseTradeDetails } from '@/services/trade/schema';
import { computePortfolioValuation, type PortfolioValuation } from '@/services/trade/valuation';
import { colors, layout, spacing } from '@/theme';
import type { Decision } from '@/types/domain';

// ticker(없으면 종목명) 기준 그룹핑 — 파싱·그룹핑은 호출자 책임(getTradeDecisionRows 관례).
function groupRows(decisions: Decision[]): StockDecisionRow[] {
  const map = new Map<string, StockDecisionRow>();
  for (const d of decisions) {
    const td = parseTradeDetails(d.structuredJson);
    if (!td) continue;
    const key = td.ticker ?? td.name;
    const isDelib = d.status === 'deliberating';
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (isDelib) existing.deliberatingCount += 1;
    } else {
      map.set(key, { key, name: td.name, ticker: td.ticker ?? undefined, count: 1, deliberatingCount: isDelib ? 1 : 0 });
    }
  }
  return [...map.values()];
}

// Profile.md에서 '## 매매 원칙' 섹션 원문만 추출(다음 heading 전까지). 없으면 null.
function extractPrinciples(profile: string): string | null {
  const lines = profile.split('\n');
  const idx = lines.findIndex((l) => /^#{1,6}\s*매매\s*원칙/.test(l.trim()));
  if (idx < 0) return null;
  const out: string[] = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    if (/^#{1,6}\s/.test(lines[i].trim())) break;
    out.push(lines[i]);
  }
  const text = out.join('\n').trim();
  return text || null;
}

export default function InvestScreen() {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [rows, setRows] = useState<StockDecisionRow[]>([]);
  const [watch, setWatch] = useState<PrincipleWatchResult | null>(null);
  const [principlesText, setPrinciplesText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const snap = await getLatestPortfolioSnapshot(db);
      if (!alive) return;
      setSnapshot(snap);
      const decisions = await getTradeDecisionRows(db);
      if (!alive) return;
      setRows(groupRows(decisions));
      const profile = await readUserProfile(db);
      if (!alive) return;
      setPrinciplesText(profile ? extractPrinciples(profile) : null);
      setLoading(false);

      // 무거운(네트워크·Gemini) 조회는 코어 렌더 후 비동기로.
      if (snap) {
        const v = await computePortfolioValuation(db, snap);
        if (alive) setValuation(v);
      }
      setWatching(true);
      const w = await runPrincipleWatch(db);
      if (alive) { setWatch(w); setWatching(false); }
    })();
    return () => { alive = false; };
  }, [db]));

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Highlight vary="invest-title">
          <AppText preset="displayCompact">투자</AppText>
        </Highlight>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}>
          <PortfolioCard
            snapshot={snapshot}
            valuation={valuation}
            onImport={() => router.push('/portfolio-import')}
          />

          <View style={styles.section}>
            <AppText preset="caption" color={colors.text.tertiary}>결정이 있는 종목</AppText>
            <StockDecisionList rows={rows} onPress={(key) => router.push(`/stock/${encodeURIComponent(key)}`)} />
          </View>

          {watching && !watch ? (
            <AppText preset="caption" color={colors.text.tertiary}>원칙 대조 중…</AppText>
          ) : (
            <PrincipleWatchSection watch={watch} principlesText={principlesText} />
          )}
        </ScrollView>
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.screenPaddingX, paddingTop: layout.headerPaddingTop, paddingBottom: spacing.sm },
  loader: { marginTop: spacing['4xl'] },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.sm, gap: spacing.lg },
  section: { gap: spacing.sm },
});
