import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

// 녹음 중 실시간 진폭 막대 — "녹음되고 있나?" 불안 해소(음성-우선 앱 기본 요소).
// expo-audio metering(dBFS, 대략 -60~0)을 0~1 진폭으로 매핑해 바를 좌→우로 흘려보낸다.
const BARS = 28;
const FLOOR_DB = -60;
const MAX_BAR = 44;
const MIN_BAR = 3;

interface Props {
  /** 현재 레벨(dBFS). metering 미지원/무음 시 undefined */
  db?: number;
  active: boolean;
}

export function LevelMeter({ db, active }: Props) {
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(0));
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    if (!active) {
      setLevels(new Array(BARS).fill(0));
      return;
    }
    const id = setInterval(() => {
      const d = dbRef.current;
      const amp = d == null ? 0 : Math.max(0, Math.min(1, (d - FLOOR_DB) / -FLOOR_DB));
      setLevels((prev) => [...prev.slice(1), amp]);
    }, 90);
    return () => clearInterval(id);
  }, [active]);

  return (
    <View style={styles.row}>
      {levels.map((a, i) => (
        <View key={i} style={[styles.bar, { height: MIN_BAR + a * MAX_BAR }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: MAX_BAR + MIN_BAR },
  bar: { width: 3, borderRadius: radius.pill, backgroundColor: colors.text.onMedia },
});
