// 종이 연결 장식 — 쇠 바인더 고리(앞면 오른쪽 호만 보이게). (파일명은 옛 Paperclip 자리)
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme';

// 세로 고리의 '앞쪽(오른쪽) 호'만 그린다 — 왼쪽(뒷면)은 종이 뒤로 넘어가 안 보이는 셈.
// 어두운 밑선 + 금속 그라데이션 본선 + 하이라이트로 쇠 질감.
function Ring({ height, gid }: { height: number; gid: string }) {
  const w = height * 0.64;
  return (
    <Svg width={w} height={height} viewBox="0 0 30 48">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.text.onMedia} stopOpacity={0.95} />
          <Stop offset="0.4" stopColor={colors.text.tertiary} stopOpacity={1} />
          <Stop offset="1" stopColor={colors.text.secondary} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      {/* 입체 그림자(어두운 밑선) */}
      <Path d="M15 5 A 12 19 0 0 1 15 43" stroke={colors.text.primary} strokeOpacity={0.45} strokeWidth={6} fill="none" strokeLinecap="round" />
      {/* 금속 본선 */}
      <Path d="M15 4 A 12 20 0 0 1 15 44" stroke={`url(#${gid})`} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      {/* 광택 하이라이트 */}
      <Path d="M15 8 A 11 17 0 0 1 23 23" stroke={colors.text.onMedia} strokeOpacity={0.75} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

interface Props {
  /** 고리 개수(기본 3) */
  count?: number;
  /** 고리 세로 길이(px, 기본 44) */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 쇠 바인더 고리 한 줄 — 위 카드와 아래 종이를 꿰어 묶은 듯한 연결 장식.
 * 각 고리는 '앞쪽 오른쪽 호'만 보이고 왼쪽은 종이 뒤로 사라진 것처럼 표현한다.
 * 두 종이의 경계에 걸쳐 absolute로 얹는다. 색은 토큰 경유.
 */
export function BinderRings({ count = 3, size = 44, style }: Props) {
  const uid = useId().replace(/:/g, '');
  return (
    <View style={[styles.row, style]} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Ring key={i} height={size} gid={`${uid}-${i}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
});
