# IA 개편 — 구현 가이드 (I1~I4: 결정 상세 · 투자 탭 · 5탭 재편 · 카드 시각 언어)

> 등급: 구현 지시서(승인된 설계). `docs/INDEX.md` 등재.
> 작성: 2026-07-11. 시안: `SnackShot-IA-Overhaul-Mockup.html`(사용자 승인 — 5탭·HTML 목업 선택, 2026-07-11 문답 반영).
> **설계 결정은 검토·확정된 것이다. 재설계하지 말고 그대로 구현하라.** 코드와 충돌하면 코드 우선 + 완료 보고에 기록.
> **공통 규칙·함정 목록·DB 검증 레시피는 `SnackShot-Decision-Enhancement-Guide.md` 0장을 그대로 따른다.**
> **UI 트랙 특칙**: 모든 phase가 에뮬레이터 시각 확인을 요구한다(Metro reload). 세션당 1 phase 엄수. 편집 후 파일 잘림(동기화 truncation) 확인 — 이 대화들에서 4회 재발했다.

## 배경 (2026-07-11 사용자 피드백 → 방향 합의)

기능(D~H 트랙)은 완비됐으나 정보 구조가 초기 그대로 — Inbox 하나에 검토 덱·todo 보드·전체 목록·통계·투자 진입점이 전부 매달려 있고, 기능마다 시트·배지·접이식으로 붙여 발견성이 낮다. 사용자 피드백: 주식 접근성·시인성 부족, todo/결정/과거/유사 구분 곤란. 합의된 방향: **5탭(Today·Archive·Inbox·결정·투자) + 결정 상세 화면 + 투자 대시보드(차트에 결정 마커)**. 상세 레이아웃·문안은 목업 HTML이 시각 사양이다 — 목업과 지시서가 다르면 지시서 우선.

**권장 실행 순서: I1 → I3 → I2 → I4.** I1이 모든 카드의 착지점이라 최우선. I3은 I1(마커→상세)에 의존. I2(탭 재편)는 화면이 갖춰진 뒤 이동만 하는 마지막이 안전. I4는 독립 — 여유 세션에.
마이그레이션: I3에 additive 1건(vNEXT — 착수 시점 TARGET_VERSION 확인). 나머지 phase 스키마 무변경.

---

## I1. 결정 상세 화면 `/decision/[id]` (최우선 — 스키마 무변경)

**목적**: 시트 4종·카드 확장에 흩어진 결정의 맥락을 한 화면에. 모든 결정 카드의 탭 = 이 화면으로 통일.

### (a) 라우트·구성

`app/decision/[id].tsx` 신설(`app/entry/[id].tsx` 선례 — @codemap 헤더 부착). 화면은 조립만 하고 섹션은 `src/components/decision/detail/` 하위로 분리(200줄 규칙):

1. **헤더**: 요약(user 우선) + 칩 행 — 카테고리(I4 색, I4 전이면 기존 스타일)·상태 배지(미결/진행/완료/반려)·본인 확신(없으면 AI 확신, `userConfidence ?? confidence`)·origin(🎙 발굴/✍ 작성)·티커.
2. **상황·이유·대안**(user 우선 COALESCE) + 액션: `▶ 원본 보기`(→ `/entry/[id]`, 결정의 entryId)·`✎ 수정`(기존 `EditDecisionSheet` 재사용).
3. **매매 블록**(tradeDetails 있을 때만): `TradeQuoteCompare` 재사용 + 목표가/손절가 표시 + 원칙 충돌(I3의 캐시가 있으면 conflicts 표시 — I3 전이면 섹션 생략, 순환 의존 금지).
4. **비슷했던 과거 (상시)**: `getSimilarPastDecisions`(F1) 결과를 배지가 아니라 **섹션으로 상시** 렌더(결과·교훈 포함, PastDecisionsSheet의 행 스타일 재사용). 항목 탭 → 그 결정의 상세로 push(스택 중첩 허용).
5. **연관 결정**: `getRelatedDecisions`(D4 링크) — 있을 때만.
6. **회고 타임라인**: 신규 repo `getOutcomeHistory(db, decisionId)` — **deleted_at 포함 전체**를 `created_at DESC`로. deleted_at 있는 행은 "잠정 판단(재확인으로 되돌림)" 라벨로 표시(F4의 soft-delete가 데이터를 남기므로 가능 — 이력 열람 전용, 복원 액션 없음). 고정 이벤트(기록=extractedAt·확정=confirmedAt·수행=executedAt)를 outcome 행 사이에 시간순 병합.

### (b) 진입점 배선 (탭=상세로 통일 — 확정)

- `DecisionList` 행 탭: 기존 인라인 상세 확장 **제거** → `router.push('/decision/[id]')`. (확장 코드 삭제로 파일 축소 — dead code 금지.)
- inbox 보드 카드(진행 중·후속·미결·회고 대기) 탭: 기존 editTarget 시트 → 상세 push로 교체. **빠른 액션(체크·결과 이모지·롱프레스 액션시트)은 카드에 유지** — 상세는 탐색용, 카드는 처리용.
- 아카이브 검색의 결정 카드(`TimelineDecisionItem`) 탭 → 상세.
- 덱(검토 후보)은 **제외**(확정) — extracted는 아직 결정이 아니고 덱 UX(스와이프)가 완결적.

### 수용 기준

① 목록·보드·검색 3경로에서 상세 진입 ② 매매 결정에서 시세 대조·수동 폴백 동작 ③ 유사 과거 섹션 상시 표시(없으면 "아직 비슷한 기록 없음" 1줄) ④ 재후속 이력이 있는 결정(devSeed)에서 타임라인에 "잠정 판단(되돌림)" 표시 ⑤ 원본 보기→entry 화면 ⑥ 미결 결정 상세에서 "결정했다" 동작(기존 플로우 재사용) ⑦ verify PASS + 에뮬레이터 시각 확인.

---

## I3. 투자 탭 + 종목 상세 (vNEXT 마이그레이션 1건)

**H0 재확인(전제)**: 주문·추천·예측·실시간 없음. 이 탭은 "내 결정과 보유 현황의 열람실"이다.

### (a) vNEXT — 원칙 대조 캐시

`ALTER TABLE portfolio_snapshots ADD COLUMN principle_check_json TEXT` (additive). 내용: `{ checkedAt, principlesHash, conflicts: [{rule, issue}] }`. repo에 `updateSnapshotPrincipleCheck` 추가, 카탈로그 갱신.

### (b) 원칙 상시 대조 — `src/services/trade/principleWatch.ts` 신설

목업의 "카카오 24% 충돌" 실현부. 원칙은 자유 텍스트라 코드 검산 불가 → **Gemini 1회 호출+캐시**(확정):

- 투자 탭 진입 시 lazy 실행: 최신 스냅샷 로드 → Profile.md 원칙 읽기(`readUserProfile`) → `principlesHash`(djb2 — E1 해시 선례)와 캐시의 hash·snapshotId 비교 → 같으면 캐시 재사용, 다르면 `checkPrinciples`(H2, 전체 포트폴리오 컨텍스트) 1회 호출 후 (a)에 저장.
- 실패·키 없음·vault 미연동 → 섹션 숨김(조용 — 표시 기능이므로). 스냅샷 저장(portfolio-import) 직후에도 동일 로직 1회.
- **저장·행동 차단 없음**, 표시만(H0).

### (c) 투자 탭 `app/(tabs)/invest.tsx` (I2 전에는 `app/invest.tsx` 스택 라우트로 만들고 I2에서 탭 승격 — 확정)

1. **포트폴리오 카드**: 최신 스냅샷(없으면 "📷 캡처로 시작" 안내 + `/portfolio-import` 버튼). 평가액 = Σ(quantity × 최신 종가) — `getDailyCloseCached`(오늘 기준, T+1이라 직전 영업일) 종목별 캐시 우선 조회, 시세 실패 종목은 valuationAmount(캡처값) 폴백, 그것도 없으면 해당 종목 제외+캡션. 갱신 버튼 = portfolio-import 진입(기존 DecisionList 하단 진입점은 제거·이관).
2. **결정 있는 종목 리스트**: 신규 repo `getTradeDecisionRows(db)` — `structured_json IS NOT NULL AND deleted_at IS NULL AND status IN ('confirmed','edited','deliberating')` 전량 로드, **파싱·ticker 그룹핑은 호출자(서비스)에서**(JSON 파싱은 호출자 책임 관례. 개인 도구 규모라 전량+코드 필터 확정 — JSON LIKE 검색 금지, 취약). 행: 종목명·결정 N(미결 n)·등락(quotes 캐시만, 없으면 생략). 탭 → (d).
3. **원칙 섹션**: Profile.md `## 매매 원칙` 원문 + (b)의 conflicts를 경고 카드로.

### (d) 종목 상세 `app/stock/[ticker].tsx`

1. **일봉 차트 + 결정 마커**: `getDailyCandles(ticker, 90)` + 이 종목 결정들. 마커 좌표 = 결정 기준일(`confirmed_at ?? extracted_at`의 yyyyMMdd)을 candles 배열에서 이분 탐색 — 휴장일이면 **다음 거래일로 스냅**, 범위 밖(90일 이전)이면 생략. ▲ buy=`feedback.success` / ▼ sell=`feedback.danger` / ◇ deliberating=`brand.primary`(decide_by가 미래면 우측 가장자리에 점선). svg는 DailyQuotesPanel의 Polyline 선례 재사용. **마커 자체의 탭은 미채택**(터치 정확도 — 확정): 시각화 전용, 내비게이션은 아래 리스트가 담당.
2. **이 종목의 결정 리스트**: 시간 역순, 마커 기호·결과 이모지·미결 스탬프. 행 탭 → I1 상세.
3. **이 종목 교훈 모음**: 이 종목 결정들의 outcomes.learnings 나열(없으면 섹션 생략).

### 수용 기준

① 인메모리 vNEXT 통과 ② 캡처 스냅샷 있는 상태에서 평가액·폴백 동작 ③ 원칙 대조: 최초 진입 1회 호출→재진입 캐시(로그로 확인), 원칙 수정 후 재호출 ④ 차트에 devSeed 매매 결정 마커 3종 표시·휴장일 스냅 ⑤ 행 탭→I1 상세 ⑥ 시세 키 없음/오프라인에서 화면이 깨지지 않고 안내 표시 ⑦ verify PASS + 에뮬레이터.

---

## I2. 5탭 재편 + 설정 이동 (스키마 무변경)

### (a) 탭 구성 (확정 — 사용자 선택)

`app/(tabs)/_layout.tsx`: **Today · Archive · Inbox · 결정 · 투자**. 설정은 탭에서 제거.

- **설정 이동**: `app/(tabs)/settings.tsx` → `app/settings.tsx`(스택). `TodayHeader`에 ⚙ 아이콘 버튼(우상단) → `router.push('/settings')`. 설정 내부 링크·포커스 로직(Profile 자동 로드 등) 회귀 확인.
- **결정 탭** `app/(tabs)/decisions.tsx`: 상단 `DecisionStats`(접이식 아님 — 상시, 목업 ②) + 고민 중/진행 중/회고 대기 섹션(기존 inbox 보드 컴포넌트 **이동**, store는 useInboxStore 공유 — 신규 store 금지(과설계)) + "전체 기록 →"(DecisionList). 기존 `app/decisions.tsx` 딥링크 라우트는 새 탭으로 흡수·삭제.
- **투자 탭**: I3의 `app/invest.tsx`를 `app/(tabs)/invest.tsx`로 승격.
- **Inbox 축소**: 남는 것 — AI 후보 덱(+낮은 확신 접힘) · 후속 확인 도래 · **마감 도래 미결만**(decide_by ≤ now. 미도래 미결은 결정 탭 "고민 중"에). 보드 진행 중/완료/전체 목록/통계 코드는 결정 탭으로 이동 후 inbox에서 제거(dead code 금지). 헤더의 덱/보드/목록 토글 제거 — 단일 목적 화면으로.

### (b) 배지·딥링크 정합

- Inbox 탭 배지 = 후보 + 후속 도래 + 마감 도래 미결(loadBadge 확장 — countDeliberatingDue 신설).
- 알림 딥링크 `data.url`(현재 `/(tabs)/inbox`) 전수 확인: 후속 알림은 inbox 유지 OK, **미결 마감 알림은 inbox로**(마감 도래분이 inbox에 있으므로 정합 ✓). 위젯 서비스가 참조하는 라우트 문자열 grep 전수 확인.
- expo-router 탭 이름 변경에 따른 `.expo/types` 재생성 — 잘림 손상 전례 확인.

### 수용 기준

① 5탭 표시·전환 ② Today ⚙→설정 진입, 설정 전 기능 회귀 없음(키 입력·프로필·알림 토글·DevTools) ③ Inbox에 처리 항목만, 배지 수 일치 ④ 결정 탭에서 보드 전체 동작(확정 전이·결과 기록·재후속) ⑤ 알림 탭→올바른 화면 ⑥ verify PASS + 에뮬레이터 탭 전수 스모크.

---

## I4. 카드 시각 언어 (독립 — 스키마 무변경)

- **카테고리 색 토큰 신설**: `src/theme`에 semantic `colors.category.{investment,relationship,career,daily,other}` — 기존 palette 값 재사용(amber/teal/terra/green/sand 계열), 신규 원시값 추가 금지 원칙(필요 시 토큰 추가 절차).
- **공용 카드 요소** (`DecisionCardBody` 중심 — 덱·보드·목록·검색이 공유):
  ① 카테고리 칩 색상화(위 토큰) ② origin 아이콘(발굴=마이크, 작성=펜 — 기존 `Icon` 세트 확인 후 없으면 추가) ③ 매매 결정: 티커 칩 + 등락률(**quotes 캐시만 조회, API 호출 금지** — 캐시 없으면 등락 생략) ④ 확신 병기: "확신 90% (본인 70%)" — userConfidence 있을 때만 괄호 ⑤ 미결 스탬프: DeliberatingCard의 스탬프 스타일을 `src/components/decision/DeliberatingStamp.tsx`로 공용화.
- 목업 ①②의 카드가 시각 사양. 색·간격은 전부 토큰(절대 금지 조항).

### 수용 기준

덱·보드·목록·검색 4곳에서 새 시각 언어 일관 표시, 카테고리 5종 색 구분, 등락 칩이 캐시 없을 때 생략됨(API 미호출 로그 확인), verify PASS + 에뮬레이터.

---

## 진행·보고

- 세션당 1 phase, 코드 변경은 feature-dev 스킬 경유(가용 시). 완료 게이트: verify PASS + 수용 기준 + **에뮬레이터 시각 확인** + CLAUDE.md 이력 행 + 편차 기록 + 파일 잘림 확인.
- I3의 vNEXT는 착수 시점 TARGET_VERSION 확인(현재 v24) + lock 갱신.
- phase 완료 시 해당 섹션 `✅ 완료(날짜)` 표기, 전체 완료 시 INDEX 상태 전환 + CODEMAP 라우트 현행화(신규 라우트 4개: decision/[id]·invest·stock/[ticker]·settings 이동).
