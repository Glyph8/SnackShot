import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui';
import { colors, iconSize, radius } from '@/theme';

// 카메라 화면 좌하단 — 스마트폰 기본 카메라처럼 최근 사진 썸네일. 탭 → 인앱 갤러리.
// 순수 프레젠테이션. 최근 사진 uri·onPress는 부모(record)가 주입한다.
interface Props {
  latestUri: string | null;
  onPress(): void;
}

const SIZE = 48;

export function GalleryButton({ latestUri, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.btn} accessibilityLabel="갤러리 열기" accessibilityRole="button">
      {latestUri ? (
        <Image source={{ uri: latestUri }} style={styles.fill} contentFit="cover" transition={120} />
      ) : (
        <View style={[styles.fill, styles.placeholder]}>
          <Icon name="photo" size={iconSize.md} color={colors.text.onMedia} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: SIZE, height: SIZE, borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 2, borderColor: colors.text.onMedia,
    backgroundColor: colors.media.controlScrim,
  },
  fill: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
