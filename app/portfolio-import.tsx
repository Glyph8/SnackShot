/** @codemap 포트폴리오 캡처 가져오기(/portfolio-import) — 증권앱 스크린샷 → Gemini 파싱 → 확인·저장
 *  데이터: services/label(parsePortfolioImage) · db/portfolio · 관련: H3(투자 확장), ADR-027(코드 검산)
 */
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { AppText, Button, ScreenBackground } from '@/components/ui';
import { insertPortfolioSnapshot } from '@/db';
import { runPrincipleWatch } from '@/services/trade/principleWatch';
import { getLabelService } from '@/services/label';
import { flagHoldingReview, type Holding } from '@/services/trade/portfolio';
import { colors, radius, spacing } from '@/theme';

const NOTICE = '캡처 이미지는 Gemini API로 전송되며 기기에 저장되지 않습니다.';

// 편집 버퍼 — 수치는 문자열로 들고 저장 시 파싱.
interface EditRow {
  name: string; ticker: string;
  quantity: string; avgPrice: string; currentPrice: string;
  valuationAmount: string; purchaseAmount: string;
}

function numOrNull(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}
function str(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}
function toHolding(r: EditRow): Holding {
  return {
    name: r.name.trim(),
    ticker: r.ticker.trim() || null,
    quantity: numOrNull(r.quantity),
    avgPrice: numOrNull(r.avgPrice),
    currentPrice: numOrNull(r.currentPrice),
    valuationAmount: numOrNull(r.valuationAmount),
    purchaseAmount: numOrNull(r.purchaseAmount),
  };
}

export default function PortfolioImportScreen() {
  const db = useSQLiteContext();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<EditRow[] | null>(null); // null=아직 선택 전

  useEffect(() => {
    (async () => {
      const perm = await MediaLibrary.requestPermissionsAsync();
      setPermission(perm.granted);
      if (!perm.granted) return;
      try {
        const res = await MediaLibrary.getAssetsAsync({
          first: 24, mediaType: MediaLibrary.MediaType.photo,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        setAssets(res.assets);
      } catch (e) {
        console.warn('[portfolio] asset load failed', e);
      }
    })();
  }, []);

  const handlePick = useCallback(async (asset: MediaLibrary.Asset) => {
    if (busy) return;
    setBusy(true);
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      const uri = info.localUri ?? asset.uri;
      const base64 = await new File(uri).base64();
      const mime = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const result = await getLabelService().parsePortfolioImage(base64, mime);
      if (result.holdings.length === 0) {
        Alert.alert('보유 종목 없음', '잔고/보유 화면 캡처가 맞는지 확인해 주세요.');
        return;
      }
      setRows(result.holdings.map((h) => ({
        name: h.name, ticker: h.ticker ?? '',
        quantity: str(h.quantity), avgPrice: str(h.avgPrice), currentPrice: str(h.currentPrice),
        valuationAmount: str(h.valuationAmount), purchaseAmount: str(h.purchaseAmount),
      })));
    } catch (e) {
      console.error('[portfolio] parse failed', e);
      Alert.alert('파싱 실패', 'Gemini 키 설정을 확인하거나 다른 캡처로 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const updateRow = useCallback((i: number, patch: Partial<EditRow>) => {
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  }, []);

  const handleSave = useCallback(async () => {
    if (!rows) return;
    const holdings = rows.map(toHolding).filter((h) => h.name.length > 0);
    if (holdings.length === 0) { Alert.alert('저장할 종목 없음'); return; }
    setBusy(true);
    try {
      await insertPortfolioSnapshot(db, { source: 'image', holdings });
      // I3(b): 새 스냅샷 저장 직후 원칙 대조 1회(캐시 워밍) — 실패·키 없음은 조용, 화면 이동 비차단.
      void runPrincipleWatch(db).catch(() => {});
      router.back();
    } catch (e) {
      console.error('[portfolio] save failed', e);
      Alert.alert('저장 실패', '다시 시도해 주세요.');
      setBusy(false);
    }
  }, [db, rows]);

  return (
    <ScreenBackground edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.lg}>
          <AppText preset="bodyLarge" color={colors.text.link}>닫기</AppText>
        </Pressable>
        <AppText preset="titleMedium">포트폴리오 가져오기</AppText>
        <View style={styles.headerSpacer} />
      </View>
      <AppText preset="caption" color={colors.text.tertiary} style={styles.notice}>{NOTICE}</AppText>

      {busy && <ActivityIndicator style={styles.loader} color={colors.brand.primary} />}

      {permission === false && (
        <View style={styles.center}>
          <AppText preset="bodyMedium" color={colors.text.secondary}>사진 접근 권한이 필요해요.</AppText>
        </View>
      )}

      {rows == null ? (
        <ScrollView contentContainerStyle={styles.grid}>
          {assets.map((a) => (
            <Pressable key={a.id} onPress={() => handlePick(a)} disabled={busy} style={styles.thumbWrap}>
              <Image source={{ uri: a.uri }} style={styles.thumb} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {rows.map((r, i) => {
            const review = flagHoldingReview(toHolding(r));
            return (
              <View key={i} style={[styles.card, review && styles.cardReview]}>
                {review && (
                  <AppText preset="caption" color={colors.accent.pin}>⚠ 수량×단가와 금액이 맞지 않아요 — 확인 필요</AppText>
                )}
                <View style={styles.nameRow}>
                  <TextInput style={[styles.input, styles.flex2]} value={r.name} onChangeText={(v) => updateRow(i, { name: v })} placeholder="종목명" placeholderTextColor={colors.text.tertiary} />
                  <TextInput style={[styles.input, styles.flex1]} value={r.ticker} onChangeText={(v) => updateRow(i, { ticker: v })} placeholder="코드" placeholderTextColor={colors.text.tertiary} keyboardType="number-pad" />
                </View>
                <View style={styles.numRow}>
                  <NumField label="수량" value={r.quantity} onChange={(v) => updateRow(i, { quantity: v })} />
                  <NumField label="평단" value={r.avgPrice} onChange={(v) => updateRow(i, { avgPrice: v })} />
                </View>
                <View style={styles.numRow}>
                  <NumField label="현재가" value={r.currentPrice} onChange={(v) => updateRow(i, { currentPrice: v })} />
                  <NumField label="평가금액" value={r.valuationAmount} onChange={(v) => updateRow(i, { valuationAmount: v })} />
                </View>
                <View style={styles.numRow}>
                  <NumField label="매입금액" value={r.purchaseAmount} onChange={(v) => updateRow(i, { purchaseAmount: v })} />
                  <View style={styles.flex1} />
                </View>
              </View>
            );
          })}
          <Button label="저장" onPress={handleSave} disabled={busy} fullWidth style={styles.saveBtn} />
          <Button label="다른 캡처 선택" variant="secondary" onPress={() => setRows(null)} disabled={busy} fullWidth />
        </ScrollView>
      )}
    </ScreenBackground>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <View style={styles.numField}>
      <AppText preset="caption" color={colors.text.secondary}>{label}</AppText>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="number-pad" placeholder="—" placeholderTextColor={colors.text.tertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  headerSpacer: { width: 40 },
  notice: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  loader: { marginVertical: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md },
  thumbWrap: { width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface.sunken },
  thumb: { width: '100%', height: '100%' },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.card, backgroundColor: colors.surface.paper },
  cardReview: { borderColor: colors.accent.pin },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  numRow: { flexDirection: 'row', gap: spacing.sm },
  numField: { flex: 1, gap: spacing.xs },
  input: { backgroundColor: colors.surface.sunken, borderRadius: radius.md, color: colors.text.primary, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  saveBtn: { marginTop: spacing.md },
});
