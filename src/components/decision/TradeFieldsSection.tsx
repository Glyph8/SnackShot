import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, CollapsibleSection } from '@/components/ui';
import { DailyQuotesPanel, type PriceField } from '@/components/decision/DailyQuotesPanel';
import { TickerSearchField } from '@/components/decision/TickerSearchField';
import { getQuoteApiKey, getTwelveDataKey } from '@/lib/env';
import { SIDE_LABEL, type TradeDetails } from '@/services/trade/schema';
import { colors, radius, spacing } from '@/theme';

// H1: 매매 정보 입력 섹션(compose의 investment 카테고리 전용, 전 필드 선택).
// 자체 상태를 들고 onChange로 TradeDetails|null을 emit한다(name 비면 null).

const SIDES: TradeDetails['side'][] = ['buy', 'sell', 'hold'];

function numOr(s: string): number | undefined {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? undefined : n;
}

interface Props {
  onChange(td: TradeDetails | null): void;
  editable?: boolean;
}

export function TradeFieldsSection({ onChange, editable = true }: Props) {
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [side, setSide] = useState<TradeDetails['side']>('buy');
  const [amountKrw, setAmountKrw] = useState('');
  const [quantity, setQuantity] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [eventTrigger, setEventTrigger] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [k1, k2] = await Promise.all([getQuoteApiKey(), getTwelveDataKey()]);
      if (alive) setSearchEnabled(!!k1 || !!k2);
    })();
    return () => { alive = false; };
  }, []);

  const handlePickPrice = (field: PriceField, price: number) => {
    const v = String(price);
    if (field === 'entryPrice') setEntryPrice(v);
    else if (field === 'targetPrice') setTargetPrice(v);
    else setStopPrice(v);
  };

  useEffect(() => {
    const nm = name.trim();
    if (!nm) { onChange(null); return; }
    onChange({
      kind: 'trade',
      name: nm,
      side,
      ticker: ticker.trim() || undefined,
      amountKrw: numOr(amountKrw),
      quantity: numOr(quantity),
      entryPrice: numOr(entryPrice),
      targetPrice: numOr(targetPrice),
      stopPrice: numOr(stopPrice),
      eventTrigger: eventTrigger.trim() || undefined,
    });
  }, [name, ticker, side, amountKrw, quantity, entryPrice, targetPrice, stopPrice, eventTrigger, onChange]);

  return (
    <CollapsibleSection title="매매 정보 (선택)" hint="투자 결정용">
      <View style={styles.body}>
        <TickerSearchField
          name={name}
          ticker={ticker}
          onChangeName={setName}
          onChangeTicker={setTicker}
          searchEnabled={searchEnabled}
          editable={editable}
        />
        <Row label="방향">
          <View style={styles.sideRow}>
            {SIDES.map((s) => {
              const on = side === s;
              return (
                <Pressable key={s} style={[styles.sideChip, on && styles.sideOn]} onPress={() => editable && setSide(s)}>
                  <AppText preset="bodySmall" color={on ? colors.brand.onPrimary : colors.text.secondary}>{SIDE_LABEL[s]}</AppText>
                </Pressable>
              );
            })}
          </View>
        </Row>
        <Row label="금액(원)">
          <NumInput value={amountKrw} onChangeText={setAmountKrw} editable={editable} placeholder="예: 1000000" />
        </Row>
        <Row label="수량">
          <NumInput value={quantity} onChangeText={setQuantity} editable={editable} placeholder="예: 10" />
        </Row>
        <Row label="진입가">
          <NumInput value={entryPrice} onChangeText={setEntryPrice} editable={editable} placeholder="예: 68000" />
        </Row>
        <Row label="목표가">
          <NumInput value={targetPrice} onChangeText={setTargetPrice} editable={editable} placeholder="선택" />
        </Row>
        <Row label="손절가">
          <NumInput value={stopPrice} onChangeText={setStopPrice} editable={editable} placeholder="선택" />
        </Row>
        <Row label="이벤트 대기">
          <TextInput style={styles.input} value={eventTrigger} onChangeText={setEventTrigger} editable={editable}
            placeholder="예: 실적 발표 후" placeholderTextColor={colors.text.tertiary} />
        </Row>

        <DailyQuotesPanel ticker={ticker} keyAvailable={searchEnabled} onPickPrice={handlePickPrice} />
      </View>
    </CollapsibleSection>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText preset="caption" color={colors.text.secondary} style={styles.rowLabel}>{label}</AppText>
      <View style={styles.rowInput}>{children}</View>
    </View>
  );
}

function NumInput(props: { value: string; onChangeText(v: string): void; editable: boolean; placeholder: string }) {
  return (
    <TextInput
      style={styles.input}
      value={props.value}
      onChangeText={props.onChangeText}
      editable={props.editable}
      keyboardType="number-pad"
      placeholder={props.placeholder}
      placeholderTextColor={colors.text.tertiary}
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLabel: { width: 72 },
  rowInput: { flex: 1 },
  input: {
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    color: colors.text.primary, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  sideRow: { flexDirection: 'row', gap: spacing.sm },
  sideChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border.card, backgroundColor: colors.surface.paper,
  },
  sideOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
});
