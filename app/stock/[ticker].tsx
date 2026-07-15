/** @codemap 종목 상세(/stock/:ticker) — 일봉 차트+결정 마커·이 종목 결정 리스트·교훈 모음
 *  데이터: quotes(getDailyCandles) · @/db(decisions getTradeDecisionRows·outcomes) · trade/schema
 *  H0: 열람실 — 주문·추천 없음. 마커 탭 미채택(행 탭으로 상세 이동). 진입: 투자 탭 종목 리스트.
 */
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StockDecisionChart, type ChartMarker, type MarkerKind } from '@/components/invest/StockDecisionChart';
import { AppText, Icon, ScreenBackground, Tag } from '@/components/ui';
import { getOutcomeByDecision, getTradeDecisionRows } from '@/db';
import { nowMs } from '@/lib/time';
import { getQuoteService } from '@/services/quotes';
import type { DailyCandle } from '@/services/quotes/types';
import { parseTradeDetails, type TradeDetails } from '@/services/trade/schema';
import { colors, iconSize, layout, radius, spacing } from '@/theme';
import type { Decision, Outcome, OutcomeResult } from '@/types/domain';

const GLYPH: Record<MarkerKind, string> = { buy: '▲', sell: '▼', deliberating: '◇' };
const RESULT_EMOJI: Partial<Record<OutcomeResult, string>> = { good: '👍', bad: '👎', mixed: '🤔' };

function kindOf(d: Decision, td: TradeDetails): MarkerKind {
  if (d.status === 'deliberating') return 'deliberating';
  return td.side === 'sell' ? 'sell' : 'buy';
}

// candles 오름차순(yyyyMMdd). 기준일 이상인 첫 인덱스(휴장일→다음 거래일 스냅). 범위 밖이면 null.
function snapIndex(candles: DailyCandle[], ymd: string): number | null {
  if (candles.length === 0 || ymd < candles[0].date) return null;
  let lo = 0, hi = candles.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].date >= ymd) { ans = mid; hi = mid - 1; } else lo = mid + 1;
  }
  return ans < 0 ? null : ans;
}

export default function StockDetailScreen() {
  const db = useSQLiteContext();
  const { ticker: keyParam } = useLocalSearchParams<{ ticker: string }>();
  const key = decodeURIComponent(keyParam ?? '');

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [candles, setCandles] = useState<DailyCandle[]>([]);
  const [markers, setMarkers] = useState<ChartMarker[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome | null>>({});
  const [name, setName] = useState(key);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const all = await getTradeDecisionRows(db);
      const mine = all.filter((d) => {
        const td = parseTradeDetails(d.structuredJson);
        return td && (td.ticker === key || td.name === key);
      });
      if (!alive) return;
      setDecisions(mine);
      const firstTd = mine.map((d) => parseTradeDetails(d.structuredJson)).find(Boolean) ?? null;
      if (firstTd) setName(firstTd.name);
      const outMap: Record<string, Outcome | null> = {};
      for (const d of mine) outMap[d.id] = await getOutcomeByDecision(db, d.id);
      if (!alive) return;
      setOutcomes(outMap);
      setLoading(false);

      // 일봉은 실제 ticker 있을 때만 조회(라우터가 KRX/미국 흡수, 실패 시 빈 배열).
      const realTicker = firstTd?.ticker;
      if (realTicker) {
        let cs: DailyCandle[] = [];
        try { cs = await getQuoteService().getDailyCandles(realTicker, 90); } catch { cs = []; }
        if (!alive) return;
        setCandles(cs);
        setMarkers(buildMarkers(mine, cs));
      }
    })();
    return () => { alive = false; };
  }, [db, key]);

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.sm} style={styles.navBtn}>
          <Icon name="back" size={iconSize.lg} color={colors.text.primary} />
        </Pressable>
        <AppText preset="titleMedium" numberOfLines={1} style={styles.headerTitle}>{name}</AppText>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {candles.length > 0 && <StockDecisionChart candles={candles} markers={markers} />}

          <View style={styles.section}>
            <AppText preset="caption" color={colors.text.tertiary}>이 종목의 결정</AppText>
            {decisions.map((d) => {
              const td = parseTradeDetails(d.structuredJson);
              const kind = td ? kindOf(d, td) : 'buy';
              const o = outcomes[d.id];
              const baseMs = d.confirmedAt ?? d.extractedAt;
              return (
                <Pressable key={d.id} style={styles.row} onPress={() => router.push(`/decision/${d.id}`)}>
                  <AppText preset="bodyMedium" color={colors.brand.primary}>{GLYPH[kind]}</AppText>
                  <View style={styles.rowBody}>
                    <AppText preset="bodyMedium" numberOfLines={1}>{d.userSummary ?? d.summary}</AppText>
                    <AppText preset="caption" color={colors.text.tertiary}>
                      {format(new Date(baseMs), 'yyyy. M. d', { locale: ko })}
                    </AppText>
                  </View>
                  {d.status === 'deliberating' && <Tag label="미결" bg={colors.surface.sunken} color={colors.feedback.warning} />}
                  {o && RESULT_EMOJI[o.result] && <AppText preset="bodyMedium">{RESULT_EMOJI[o.result]}</AppText>}
                </Pressable>
              );
            })}
          </View>

          <LearningsSection decisions={decisions} outcomes={outcomes} />
        </ScrollView>
      )}
    </ScreenBackground>
  );
}

function buildMarkers(decisions: Decision[], candles: DailyCandle[]): ChartMarker[] {
  const now = nowMs();
  const out: ChartMarker[] = [];
  for (const d of decisions) {
    const td = parseTradeDetails(d.structuredJson);
    if (!td) continue;
    const kind = kindOf(d, td);
    if (kind === 'deliberating' && d.decideBy != null && d.decideBy > now) {
      out.push({ index: candles.length - 1, kind, dotted: true });
      continue;
    }
    const ymd = format(new Date(d.confirmedAt ?? d.extractedAt), 'yyyyMMdd');
    const idx = snapIndex(candles, ymd);
    if (idx == null) continue; // 범위 밖(90일 이전/이후) → 생략
    out.push({ index: idx, kind });
  }
  return out;
}

function LearningsSection({ decisions, outcomes }: { decisions: Decision[]; outcomes: Record<string, Outcome | null> }) {
  const items = decisions
    .map((d) => ({ summary: d.userSummary ?? d.summary, learnings: outcomes[d.id]?.learnings }))
    .filter((x): x is { summary: string; learnings: string } => !!x.learnings);
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <AppText preset="caption" color={colors.text.tertiary}>이 종목에서 얻은 교훈</AppText>
      {items.map((it, i) => (
        <View key={i} style={styles.learn}>
          <AppText preset="bodyMedium">{it.learnings}</AppText>
          <AppText preset="caption" color={colors.text.tertiary} numberOfLines={1}>{it.summary}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
  },
  navBtn: { width: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  loader: { marginTop: spacing['4xl'] },
  scroll: { paddingHorizontal: layout.screenPaddingX, paddingBottom: spacing['4xl'], gap: spacing.lg },
  section: { gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.card,
    backgroundColor: colors.surface.paper,
  },
  rowBody: { flex: 1, gap: 2 },
  learn: {
    gap: spacing.xs, padding: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surface.sunken,
  },
});
