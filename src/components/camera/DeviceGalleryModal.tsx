import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Icon } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';

// 휴대폰 사진 라이브러리를 인앱으로 보여주는 갤러리 (파일 시스템/OS 갤러리로 나가지 않음).
//   - 그리드: media-library 사진을 최신순 페이지네이션.
//   - 뷰어: 항목 탭 → 전체화면 스와이프(expo-image contain). 닫으면 그리드로.
// 부모(record)는 권한이 허용된 뒤에만 visible=true로 연다.
interface Props {
  visible: boolean;
  onClose(): void;
}

const PAGE = 60;
const COLS = 3;

function buildOptions(after?: string): MediaLibrary.AssetsOptions {
  return {
    first: PAGE,
    after,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    mediaType: MediaLibrary.MediaType.photo,
  };
}

export function DeviceGalleryModal({ visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const loadingRef = useRef(false);

  // 열릴 때마다 처음부터 다시 로드(최신 반영).
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setViewerIndex(null);
    setInitialLoaded(false);
    (async () => {
      try {
        const res = await MediaLibrary.getAssetsAsync(buildOptions(undefined));
        if (!alive) return;
        setAssets(res.assets);
        setCursor(res.endCursor);
        setHasNext(res.hasNextPage);
      } catch (e) {
        console.warn('[gallery] initial load failed', e);
      } finally {
        if (alive) setInitialLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [visible]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNext) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await MediaLibrary.getAssetsAsync(buildOptions(cursor));
      setAssets((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...res.assets.filter((a) => !seen.has(a.id))];
      });
      setCursor(res.endCursor);
      setHasNext(res.hasNextPage);
    } catch (e) {
      console.warn('[gallery] load more failed', e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, hasNext]);

  const cell = Math.floor(width / COLS);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={spacing.md} style={styles.headerBtn}>
              <Icon name="close" size={iconSize.md} color={colors.text.primary} />
            </Pressable>
            <AppText preset="titleMedium">갤러리</AppText>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>

        {initialLoaded && assets.length === 0 ? (
          <View style={styles.empty}>
            <AppText preset="bodyMedium" color={colors.text.secondary}>표시할 사진이 없어요.</AppText>
          </View>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(a) => a.id}
            numColumns={COLS}
            initialNumToRender={PAGE}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            renderItem={({ item, index }) => (
              <Pressable onPress={() => setViewerIndex(index)} style={{ width: cell, height: cell, padding: 1 }}>
                <Image source={{ uri: item.uri }} style={styles.fill} contentFit="cover" transition={100} recyclingKey={item.id} />
              </Pressable>
            )}
            ListFooterComponent={loading ? <ActivityIndicator style={styles.footer} color={colors.brand.primary} /> : null}
          />
        )}

        {/* 전체화면 뷰어 — 스와이프로 이동, 닫으면 그리드 */}
        {viewerIndex != null && (
          <View style={styles.viewer}>
            <FlatList
              data={assets}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(a) => a.id}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onEndReached={loadMore}
              onEndReachedThreshold={0.6}
              renderItem={({ item }) => (
                <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                  <Image source={{ uri: item.uri }} style={{ width, height }} contentFit="contain" transition={120} recyclingKey={item.id} />
                </View>
              )}
            />
            <SafeAreaView edges={['top']} style={styles.viewerClose} pointerEvents="box-none">
              <Pressable onPress={() => setViewerIndex(null)} hitSlop={spacing.lg} style={styles.viewerCloseBtn}>
                <Icon name="close" size={iconSize.md} color={colors.text.onMedia} />
              </Pressable>
            </SafeAreaView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.canvas },
  headerSafe: { backgroundColor: colors.background.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border.hairline,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%', backgroundColor: colors.surface.sunken },
  footer: { paddingVertical: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewer: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.media.cameraBg },
  viewerClose: { position: 'absolute', top: 0, left: 0, right: 0 },
  viewerCloseBtn: {
    alignSelf: 'flex-start', margin: spacing.lg,
    width: 38, height: 38, borderRadius: radius.pill,
    backgroundColor: colors.media.controlScrim,
    alignItems: 'center', justifyContent: 'center',
  },
});
