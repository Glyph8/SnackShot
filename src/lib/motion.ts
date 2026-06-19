import { LayoutAnimation, Platform, UIManager } from 'react-native';

import { duration } from '@/theme';

// 레이아웃 모션 단일 진입점. 매직넘버·중복 보일러플레이트를 없애고 duration 토큰으로 통일한다.
// (리스트 펼침/접힘, 세그먼트 전환 등 next-layout 애니메이션 전용)

// Android는 LayoutAnimation을 명시적으로 켜야 한다(모듈 최초 로드 시 1회).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** 다음 레이아웃 변화를 토큰 기반 duration으로 애니메이트(기본 fast). */
export function layoutAnimate(ms: number = duration.fast) {
  LayoutAnimation.configureNext({
    duration: ms,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
  });
}
