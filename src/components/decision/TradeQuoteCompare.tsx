import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';
import { nowMs } from '@/lib/time';
import { getDailyCloseCached } from '@/services/quotes';
import { parseTradeDetails } from '@/services/trade/schema';
import type { Decision } from '@/types/domain';
import { colors, radius, spacing } from '@/theme';

// H4: 회고 시 "진입가 vs 현재 종가" 대조. 온라인 조회 1회(캐시 우선), 실패 시 수동 입력 폴백.
// 매매 정보(entryPrice 또는 priceAtDecision) + ticker가 있을 때만 렌더(없으면 null).

function pctLine(base: number, cur: number): string {
  const pct = ((cur - base) / base) * 100;
  return `진입 ${base.toLocaleString('ko-KR')} → 현재 ${cur.toLocaleString('ko-KR')} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
}

export function TradeQuoteCompare({ decision }: { decision: Decision }) {
  const db = useSQLiteContext();
  const td = parseTradeDetails(decision.structuredJson);
  const base = td?.entryPrice ?? td?.priceAtDecision ?? null;

  const [current, setCurrent] = useState<number | null>(null);
  const [manual, setManual] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const ticker = td?.ticker ?? undefined;
  useEffect(() => {
    if (!ticker || base == null) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const c = await getDailyCloseCached(db, ticker, nowMs());
        if (!alive) return;
        if (c != null) setCurrent(c); else setFailed(true);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [db, ticker, base]);

  if (!td || base == null) return null;

  if (loading) {
    return <AppText preset="caption" color={colors.text.tertiary}>현재 시세 조회 중…</AppText>;
  }
  if (current != null) {
    return <AppText preset="caption" color={colors.text.secondary}>{pctLine(base, current)}</AppText>;
  }

  // 폴백 — 수동 종가 입력
  const man = manual.trim() ? parseFloat(manual.replace(/,/g, '')) : NaN;
  return (
    <View style={styles.manualRow}>
      <AppText preset="caption" color={colors.text.tertiary}>
        {failed ? '시세 조회 실패 — 현재가 직접 입력' : '현재가 직접 입력'}
      </AppText>
      <TextInput
        style={styles.input}
        value={manual}
        onChangeText={setManual}
        keyboardType="number-pad"
        placeholder="현재 종가"
        placeholderTextColor={colors.text.tertiary}
      />
      {!Number.isNaN(man) && (
        <AppText preset="caption" color={colors.text.secondary}>{pctLine(base, man)}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  manualRow: { gap: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.text.primary, borderRadius: radius.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15,
    color: colors.text.primary, backgroundColor: colors.surface.paper,
  },
});
