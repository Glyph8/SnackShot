import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/theme';

import { PaperTexture } from './PaperTexture';

// 도트 질감 타일 — 캔버스 색 위에 repeat로 깔린다. 알파는 PNG에 내장(약 10%).
const DOT_TILE = require('../../../assets/textures/dot-tile.png');

interface Props {
  children: ReactNode;
  /** SafeArea 적용 가장자리. 미지정 시 ['top'] */
  edges?: readonly Edge[];
  /** 도트 질감 표시 여부 (기본 true) */
  textured?: boolean;
}

/**
 * 모든 일반 화면의 바탕. 모래색 캔버스 + 도트 질감.
 * 어두운 미디어 화면(카메라/프리뷰)에는 사용하지 않는다.
 */
export function ScreenBackground({ children, edges = ['top'], textured = true }: Props) {
  const content = (
    <SafeAreaView style={styles.fill} edges={edges}>
      {children}
    </SafeAreaView>
  );

  if (!textured) {
    return <View style={[styles.fill, styles.canvas]}>{content}</View>;
  }

  return (
    <View style={[styles.fill, styles.canvas]}>
      <ImageBackground
        source={DOT_TILE}
        resizeMode="repeat"
        style={StyleSheet.absoluteFill}
      />
      <PaperTexture />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  canvas: { backgroundColor: colors.background.canvas },
});
