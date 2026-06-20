import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { colors, iconSize, radius, spacing } from '@/theme';

// archive.tsx에서 분리 (P3). 전문 검색 입력 + 최근 검색 + 결과 상태 — 순수 프레젠테이션.
// store 접근은 부모(ArchiveScreen)가 콜백/값으로 주입한다.

export interface ArchiveSearchBarProps {
  searchQuery: string;
  searchFocused: boolean;
  showHistory: boolean;
  searchHistory: string[];
  isSearchMode: boolean;
  searchLoading: boolean;
  searchResultCount: number;
  onChangeQuery(q: string): void;
  onFocus(): void;
  onBlur(): void;
  onClear(): void;
  onPickHistory(q: string): void;
  onRemoveHistory(q: string): void;
}

export function ArchiveSearchBar({
  searchQuery, searchFocused, showHistory, searchHistory, isSearchMode,
  searchLoading, searchResultCount,
  onChangeQuery, onFocus, onBlur, onClear, onPickHistory, onRemoveHistory,
}: ArchiveSearchBarProps) {
  return (
    <>
      <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
        <Ionicons name="search" size={iconSize.md} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="전문 검색…"
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={onChangeQuery}
          onFocus={onFocus}
          onBlur={onBlur}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={onClear} hitSlop={spacing.sm}>
            <Ionicons name="close-circle" size={iconSize.md} color={colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {showHistory && (
        <Card padding={spacing.md} style={styles.historySection}>
          <AppText preset="caption" color={colors.text.tertiary} style={styles.historyLabel}>최근 검색</AppText>
          {searchHistory.map((q) => (
            <View key={q} style={styles.historyRow}>
              <Pressable style={styles.historyItemPressable} onPress={() => onPickHistory(q)}>
                <Ionicons name="arrow-undo-outline" size={iconSize.sm} color={colors.text.tertiary} />
                <AppText preset="bodyMedium" color={colors.text.secondary} numberOfLines={1} style={styles.historyText}>
                  {q}
                </AppText>
              </Pressable>
              <Pressable onPress={() => onRemoveHistory(q)} hitSlop={spacing.sm} style={styles.historyRemove}>
                <Ionicons name="close" size={iconSize.sm} color={colors.text.tertiary} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {isSearchMode && (
        <View style={styles.searchStatus}>
          {searchLoading ? (
            <ActivityIndicator size="small" color={colors.brand.primary} />
          ) : (
            searchResultCount > 0 && (
              <AppText preset="caption" color={colors.text.secondary}>{`${searchResultCount}개 결과`}</AppText>
            )
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface.sunken, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  searchBarFocused: { borderColor: colors.border.card, backgroundColor: colors.surface.paperRaised },
  searchInput: { flex: 1, fontSize: 15, color: colors.text.primary, padding: 0 },

  historySection: { marginBottom: spacing.sm },
  historyLabel: { marginBottom: spacing.sm },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border.hairline,
  },
  historyItemPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  historyText: { flex: 1 },
  historyRemove: { paddingLeft: spacing.md },

  searchStatus: { paddingVertical: spacing.sm, minHeight: 36, justifyContent: 'center' },
});
