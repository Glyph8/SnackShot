// 촉각 피드백 단일 진입점 (모션 `layoutAnimate`·아이콘 `Icon` 레지스트리와 동일 패턴).
// 화면은 raw `expo-haptics` 호출을 흩뿌리지 않고 이 의미 어휘만 쓴다.
//
// ⚠️ 활성화 (expo-haptics는 네이티브 모듈 → 설치 + 데브클라이언트 리빌드 필요):
//   1) `npx expo install expo-haptics`  (SDK 55 호환 버전 자동 선택)
//   2) 아래 NO-OP 본문을 파일 하단의 "활성 구현"으로 교체
//   3) 데브클라이언트 리빌드
// 설치 전까지는 안전하게 no-op으로 동작한다(빌드·실행 영향 없음). 발화 지점은 이미 모두 배선돼 있어,
// 교체하는 순간 앱 전체에서 촉각이 켜진다.

export const haptics = {
  /** 가벼운 탭 — 일시정지/재개 등 토글 */
  tap() {},
  /** 중간 임팩트 — 녹화 시작/정지 */
  impact() {},
  /** 선택 변경 — 토글·세그먼트·칩 */
  selection() {},
  /** 성공 — 저장·컨펌·완료 */
  success() {},
  /** 주의 — 기각·삭제 */
  warning() {},
  /** 오류 */
  error() {},
};

// ── 활성 구현 (설치 후 위 `export const haptics`를 아래로 교체) ──────────────────
// import * as Haptics from 'expo-haptics';
//
// async function fire(p: Promise<void>): Promise<void> {
//   try { await p; } catch { /* 미지원 기기/플랫폼은 무시 */ }
// }
//
// export const haptics = {
//   tap() { void fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); },
//   impact() { void fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); },
//   selection() { void fire(Haptics.selectionAsync()); },
//   success() { void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); },
//   warning() { void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)); },
//   error() { void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)); },
// };
