import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation, Platform, UIManager } from 'react-native';

import { duration } from '@/theme';

// 레이아웃 모션 단일 진입점. 매직넘버·중복 보일러플레이트를 없애고 duration 토큰으로 통일한다.
// (리스트 펼침/접힘, 세그먼트 전환 등 next-layout 애니메이션 전용)

// Android는 LayoutAnimation을 명시적으로 켜야 한다(모듈 최초 로드 시 1회).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── 동작 줄이기(reduce motion) ───────────────────────────────────────────────
// 모듈 전역 플래그 — 비-React 컨텍스트(layoutAnimate)에서도 읽을 수 있게 유지.
let reduceMotion = false;
void (async () => {
  try { reduceMotion = await AccessibilityInfo.isReduceMotionEnabled(); } catch { /* 무시 */ }
})();
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

/** 현재 '동작 줄이기'가 켜져 있는지(동기 조회). */
export function prefersReducedMotion(): boolean {
  return reduceMotion;
}

/** 컴포넌트에서 '동작 줄이기' 변경에 반응하는 훅. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(reduceMotion);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const v = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) setReduced(v);
      } catch { /* 무시 */ }
    })();
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);
  return reduced;
}

/** 다음 레이아웃 변화를 토큰 기반 duration으로 애니메이트(기본 fast). 동작 줄이기 시 건너뜀. */
export function layoutAnimate(ms: number = duration.fast) {
  if (reduceMotion) return;
  LayoutAnimation.configureNext({
    duration: ms,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
  });
}
