# 롱프레스 카드 액션 설계 (모션 Phase 4 후속)

> 등급: 탐색/제안(exploration). 채택 시 ADR·DesignSystem 갱신 후 확정(`docs/INDEX.md`).
> 작성일: 2026-06-21
> 배경: 모션 Phase 4에서 "압정/폴라로이드 롱프레스 '집어드는' 피드백"을 **도달 동작이 없어 보류**했다. 이 문서는 그 도달 동작을 정의해 들림 모션이 빈 제스처가 되지 않게 한다.

## 0. 결론 먼저

- **롱프레스 = 카드 빠른 액션 메뉴** + **들어올리는 촉각/모션**으로 정의한다.
- **자유 재정렬(드래그 reorder)은 권장하지 않는다** — SnackShot의 카드 정렬은 **시각(UTC ms) 시간순**이 진실원(ADR-003 "클립=1급 객체, Day=시간순 그룹화", ADR-013 "UTC Unix ms"). 임의 순서를 두려면 `sort_order` 신규 컬럼 + 마이그레이션 + ADR 개정이 필요하고, "기록은 시간이 곧 순서"라는 모델과 충돌한다. → **재정렬 대신 빠른 액션**으로 방향 전환.

## 1. 인터랙션

1. 카드를 **롱프레스(≈250ms)** → `impact` 햅틱과 함께 카드가 살짝 **들린다**(scale ~1.04 + 그림자 강화 `shadow.raised→floating`, 약간의 기울임 0). 동작 줄이기 시 모션 없이 햅틱만.
2. 동시에 **빠른 액션 시트**(기존 `ActionSheet` 재사용) 또는 카드 위 **인라인 액션 바**가 뜬다.
3. 액션 선택 후 시트 닫힘 + 카드 원위치(스프링 `soft`).
4. 빈 곳 탭/스와이프 다운으로 취소.

## 2. 카드 타입별 액션 (맥락 기반)

| 카드 | 빠른 액션 |
|------|-----------|
| **Today/Archive 모먼트(영상·음성)** | 상세 열기 · 수정 · **삭제**(소프트) · (영상) 공유 |
| **메모(텍스트)** | 수정 · 삭제 · (결정으로 승격 — 선택) |
| **결정 카드(Inbox 보드)** | 수정 · 후속일 변경 · **결정 아님**(기각) · 완료 토글 |

- 파괴적 액션(삭제·기각)은 `feedback.danger` 텍스트, **확인 다이얼로그**(`DeleteEntryDialog` 패턴) 경유. 즉시 하드삭제 금지(ADR-014 소프트 삭제 — `deleted_at` 세팅).
- 액션 집합은 카드가 이미 가진 콜백(onPress·onDelete·onEdit 등)을 재사용 → 신규 비즈니스 로직 최소.

## 3. 구현 스케치 (core RN Animated, 리빌드 불필요)

신규 프리미티브 **`LiftPressable`**(`src/components/ui`):

- props: `children` · `onPress?` · `onLongPress()` · `liftTo=1.04` · `style`.
- 롱프레스 시작 → `impact` 햅틱 + `Animated.spring(scale→liftTo)` + 그림자 토큰 상향. 해제/완료 → `spring.soft`로 복귀.
- `useReducedMotion()` 시 스케일·그림자 변화 생략(햅틱만).
- `PressableScale`과 형제 — 누르면 줄고(Scale), **길게 누르면 들린다**(Lift). 둘 다 `@/lib/haptics`·토큰만 사용.

적용: `EntryDiaryItem`·`EntryCard`·`DecisionBoardCard`의 최외곽 Pressable을 `LiftPressable`로 교체하고 `onLongPress={() => openActions(item)}` 연결. `openActions`는 화면이 `ActionSheet`(items 배열)로 처리.

## 4. ADR·게이트

- **ADR-014(소프트 삭제)**: 삭제 액션은 `deleteEntryWithCleanup`/`rejectDecision` 등 기존 경로 사용(`deleted_at`). 하드삭제·휴지통 비우기는 금지 범위.
- **ADR-003/013(시간순)**: 재정렬 미도입(상기). 도입 시 별도 ADR.
- **토큰**: 들림 그림자/스케일은 `shadow.floating`·`spring` 토큰 사용(매직넘버 금지).
- 변경 후 `npm run verify` + 에뮬레이터 확인. DesignSystem §7 "모션 프리미티브"에 `LiftPressable` 추가.

## 5. 단계

1. `LiftPressable` 프리미티브 + 햅틱/모션/reduce-motion.
2. `ActionSheet` 기반 카드 액션 묶음(타입별 items 빌더).
3. `EntryDiaryItem`→`EntryCard`→`DecisionBoardCard` 순 적용.
4. 파괴적 액션 확인 다이얼로그 연결.
5. (선택·별도 ADR) 수동 정렬이 꼭 필요하면 `sort_order` 도입 검토.

> 권장 진행: 1–4만으로 "롱프레스 들림 + 빠른 액션"이 완성된다. 재정렬(5)은 모델 변경이라 분리.
