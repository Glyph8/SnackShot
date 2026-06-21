// 촉각 피드백 단일 진입점 (모션 `layoutAnimate`·아이콘 `Icon` 레지스트리와 동일 패턴).
// 화면은 raw `expo-haptics` 호출을 흩뿌리지 않고 이 의미 어휘만 쓴다.

import * as Haptics from 'expo-haptics';

async function fire(p: Promise<void>): Promise<void> {
  try { await p; } catch { /* 미지원 기기/플랫폼은 무시 */ }
}

export const haptics = {
  tap() { void fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); },
  impact() { void fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); },
  selection() { void fire(Haptics.selectionAsync()); },
  success() { void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); },
  warning() { void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)); },
  error() { void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)); },
};
