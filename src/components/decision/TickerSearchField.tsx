import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { getQuoteService } from '@/services/quotes';
import type { SymbolHit } from '@/services/quotes/types';
import { colors, radius, spacing } from '@/theme';

// H5d: 종목명 검색 보강 — 명시적 "검색" 버튼(자동완성 금지) → 결과 탭 → name·ticker 자동 기입.
// 시세 키 없으면 검색 버튼 미노출(기능 자체 숨김 — H0 조용 원칙). 이름/코드 입력 자체는 항상 가능.

interface Props {
  name: string;
  ticker: string;
  onChangeName(v: string): void;
  onChangeTicker(v: string): void;
  searchEnabled: boolean;
  editable: boolean;
}

export function TickerSearchField({
  name, ticker, onChangeName, onChangeTicker, searchEnabled, editable,
}: Props) {
  const [results, setResults] = useState<SymbolHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  // 조회 실패(네트워크·키·API 오류) — "결과 없음"과 구분해 표시한다.
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const q = name.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setResults(null);
    try {
      setResults(await getQuoteService().searchSymbols(q));
    } catch (e) {
      console.warn('[ticker-search] failed', e);
      setError('조회 실패 — 네트워크 또는 시세 API 키를 확인해 주세요');
    } finally {
      setSearching(false);
    }
  };

  const pick = (h: SymbolHit) => {
    onChangeName(h.name);
    onChangeTicker(h.ticker);
    setResults(null);
    setError(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <AppText preset="caption" color={colors.text.secondary} style={styles.label}>종목명</AppText>
        <TextInput
          style={[styles.input, styles.flex1]}
          value={name}
          onChangeText={onChangeName}
          editable={editable}
          placeholder="예: 삼성전자"
          placeholderTextColor={colors.text.tertiary}
        />
        {searchEnabled && (
          <Button
            label={searching ? '검색 중' : '검색'}
            size="sm"
            variant="secondary"
            onPress={handleSearch}
            disabled={!name.trim() || searching}
          />
        )}
      </View>

      {!searchEnabled && (
        <AppText preset="caption" color={colors.text.tertiary}>
          설정에서 시세 API 키를 등록하면 종목명으로 검색할 수 있어요
        </AppText>
      )}

      {error != null && (
        <AppText preset="caption" color={colors.feedback.danger}>{error}</AppText>
      )}

      {results != null && (
        results.length === 0 ? (
          <AppText preset="caption" color={colors.text.tertiary}>
            검색 결과 없음 — 종목명을 확인해 주세요 (한글 검색은 국내 주식만)
          </AppText>
        ) : (
          <View style={styles.hits}>
            {results.map((h) => (
              <Pressable key={h.ticker} style={styles.hit} onPress={() => pick(h)}>
                <AppText preset="bodySmall" color={colors.text.primary}>{h.name}</AppText>
                <AppText preset="caption" color={colors.text.tertiary}>{h.ticker}</AppText>
              </Pressable>
            ))}
          </View>
        )
      )}

      <View style={styles.row}>
        <AppText preset="caption" color={colors.text.secondary} style={styles.label}>종목코드</AppText>
        <TextInput
          style={[styles.input, styles.flex1]}
          value={ticker}
          onChangeText={onChangeTicker}
          editable={editable}
          placeholder="예: 005930"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="number-pad"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { width: 72 },
  input: {
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    color: colors.text.primary, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  flex1: { flex: 1 },
  hits: {
    gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.card, backgroundColor: colors.surface.paper,
  },
  hit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
});
