import type { ReactNode } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { borderWidth, colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

interface Props {
  /**
   * 이 자리에 들어갈 일러스트 식별자(예: 'empty-today').
   * 추후 래스터(수채/과슈) 일러스트로 교체할 지점을 코드에 명시한다.
   */
  name: string;
  /**
   * 최종 일러스트(래스터). **여기에 `require('...png')`만 넘기면 placeholder가 실물로 교체된다.**
   * 준비되면 이 prop만 채우면 끝 — 나머지 코드 변경 불필요.
   */
  source?: ImageSourcePropType;
  /** 교체 전 임시로 보여줄 콘텐츠(보통 SVG 손그림). 없으면 점선 빈 프레임. */
  placeholder?: ReactNode;
  /** 슬롯 폭(정사각 기준). 기본 168 */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 일러스트 자리표시(placeholder) 슬롯 — "나중에 실물 일러스트로 갈아끼우는 자리".
 *
 * 렌더 우선순위: `source`(실물 이미지) → `placeholder`(임시 SVG 손그림) → 점선 빈 프레임.
 * 아직 `source`가 없으면 개발 빌드(__DEV__)에서 식별자 태그(`🖼 name`)를 띄워
 * "여기 일러스트 연결 필요"임을 드러낸다. `source`가 들어오면 태그는 사라진다.
 *
 * 교체 방법(예): `<IllustrationSlot name="empty-today" source={require('@/.../empty-today.png')} />`
 */
export function IllustrationSlot({ name, source, placeholder, size = 168, style }: Props) {
  const connected = source != null;
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  return (
    <View style={[styles.wrap, { minWidth: size, minHeight: size }, style]}>
      {connected ? (
        <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
      ) : placeholder ?? (
        <View style={[styles.emptyFrame, { width: size * 0.7, height: size * 0.7 }]} />
      )}
      {dev && !connected && (
        <View style={styles.tag}>
          <AppText preset="caption" color={colors.text.onPrimary}>{`🖼 ${name}`}</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  emptyFrame: {
    borderWidth: borderWidth.thick,
    borderColor: colors.border.dashed,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    backgroundColor: colors.surface.paperRaised,
  },
  tag: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
});
