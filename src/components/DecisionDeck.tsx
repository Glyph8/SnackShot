import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { DecisionCardBody } from '@/components/DecisionCardBody';
import { AppText, Card, Pin } from '@/components/ui';
import { colors, duration, layout, radius, shadow, spacing } from '@/theme';
import type { DecisionWithEntry } from '@/stores/inbox';

const SCREEN_W = Dimensions.get('window').width;
const THRESHOLD = SCREEN_W * 0.28;
const FLY = SCREEN_W * 1.2;

interface Props {
  items: DecisionWithEntry[];
  onConfirm(item: DecisionWithEntry): void;
  onReject(item: DecisionWithEntry): void;
  onEdit(item: DecisionWithEntry): void;
}

/**
 * 스와이프 덱 모드 — 카드 1장을 크게, 뒤 스택이 비침. 좌 스와이프=기각, 우=컨펌.
 * core Animated + PanResponder 사용(babel worklet 플러그인 의존 없음).
 */
export function DecisionDeck({ items, onConfirm, onReject, onEdit }: Props) {
  const totalRef = useRef(items.length);
  if (items.length > totalRef.current) totalRef.current = items.length; // 새 로드 시 갱신

  const pos = useRef(new Animated.ValueXY()).current;
  // PanResponder는 1회 생성 → 최신 핸들러/항목을 ref로 참조
  const latest = useRef({ top: items[0], onConfirm, onReject });
  latest.current = { top: items[0], onConfirm, onReject };

  const finish = useCallback((dir: number) => {
    Animated.timing(pos, {
      toValue: { x: dir * FLY, y: 0 },
      duration: duration.base,
      useNativeDriver: true,
    }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      const { top, onConfirm: c, onReject: r } = latest.current;
      if (!top) return;
      if (dir > 0) c(top); else r(top);
    });
  }, [pos]);

  const reset = useCallback(() => {
    Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
  }, [pos]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => pos.setValue({ x: g.dx, y: g.dy * 0.2 }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > THRESHOLD) finish(1);
        else if (g.dx < -THRESHOLD) finish(-1);
        else reset();
      },
    }),
  ).current;

  const top = items[0];
  if (!top) return null;

  const rotate = pos.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const counter = `${totalRef.current - items.length + 1} / ${totalRef.current}`;

  return (
    <View style={styles.root}>
      <View style={styles.deck}>
        {items[2] && <View style={[styles.behind, styles.behind2]} />}
        {items[1] && <View style={[styles.behind, styles.behind1]} />}

        <Animated.View
          style={{ transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }}
          {...panResponder.panHandlers}
        >
          <Pin size={20} style={styles.pin} />
          <Card raised style={styles.card}>
            <View style={styles.counterRow}>
              <AppText preset="caption" color={colors.text.tertiary}>{counter}</AppText>
            </View>
            <DecisionCardBody decision={top.decision} entry={top.entry} />
          </Card>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.reject]} onPress={() => finish(-1)}>
          <Ionicons name="close" size={28} color={colors.text.secondary} />
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.edit]} onPress={() => onEdit(top)}>
          <AppText preset="button" color={colors.text.primary}>수정</AppText>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.confirm]} onPress={() => finish(1)}>
          <Ionicons name="checkmark" size={30} color={colors.brand.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  deck: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xs },
  behind: {
    position: 'absolute', left: spacing.xl, right: spacing.xl, top: '50%',
    height: 200, borderRadius: radius.lg, backgroundColor: colors.surface.paper,
    borderWidth: 1, borderColor: colors.border.card, ...shadow.card,
  },
  behind1: { transform: [{ translateY: -90 }, { scale: 0.97 }] },
  behind2: { transform: [{ translateY: -80 }, { scale: 0.94 }] },
  pin: { position: 'absolute', top: -spacing.sm, alignSelf: 'center', zIndex: 2 },
  card: { gap: spacing.md, paddingTop: spacing.xl },
  counterRow: { alignItems: 'flex-end' },
  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: spacing.xl, paddingVertical: spacing.xl,
  },
  actionBtn: {
    minHeight: layout.minTouch, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, ...shadow.card,
  },
  reject: { width: 60, height: 60, backgroundColor: colors.surface.paperRaised, borderWidth: 1, borderColor: colors.border.card },
  edit: { paddingHorizontal: spacing.xl, height: 52, backgroundColor: colors.surface.paper, borderWidth: 1, borderColor: colors.border.card },
  confirm: { width: 68, height: 68, backgroundColor: colors.brand.primary },
});
