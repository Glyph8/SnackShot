# SnackShot 디자인 시스템

> 동영상 다이어리 SnackShot의 UI/UX 기반 문서. 토큰은 `src/theme/`에 코드로 존재하며, 이 문서는 그 의미와 사용법, 컴포넌트 명세를 정의한다.
> 단일 라이트(페이퍼) 테마. 카메라·영상 등 어두운 표면은 별도 `media` 토큰으로 수용한다.

## 1. 디자인 원칙

SnackShot은 종이 다이어리의 따뜻한 질감을 화면으로 옮긴 도구다. 시각 언어는 다섯 가지 태도를 따른다.

1. **종이 위의 순간.** 배경은 도트 질감의 모래색 종이, 콘텐츠는 그 위에 놓인 카드·폴라로이드·스티키 메모다. 깊이는 색이 아니라 그림자와 겹침으로 표현한다. 질감은 도트 타일 + `PaperTexture`(섬유 결 `feTurbulence` + 가장자리 비네팅 SVG)로 강화하며, `ScreenBackground`가 콘텐츠 뒤에 깐다(정적 1회 렌더, 터치 통과).
2. **손글씨와 정돈된 본문의 대비.** 제목·날짜·워드마크는 손글씨 스크립트로 정감을, 본문·라벨·버튼은 깔끔한 산세리프로 가독성을 맡는다.
3. **테라코타 단일 강조.** 주요 액션·활성 상태는 테라코타 하나로 통일한다. 성공/신뢰도에만 초록을, 주의에만 앰버를 제한적으로 쓴다.
4. **상태는 색이 아니라 구조로도 읽힌다.** 신뢰도(%)는 막대와 수치, 카테고리는 스티키 태그처럼 색+텍스트를 함께 제공해 색각 의존을 줄인다.
5. **장식은 의미를 거든다.** 압정·테이프·기울임은 "꽂아둔 기록"이라는 은유를 강화하되 터치 영역과 가독성을 해치지 않는다.

## 2. 토큰 사용 규칙

- 컴포넌트는 **semantic 토큰만** 참조한다. `palette`(원시값)는 `tokens.ts` 내부 전용이다.
- 색·간격·라운드·그림자에 **하드코딩 금지.** 기존 화면(`app/record.tsx` 등)의 `#000`, 숫자 리터럴은 점진적으로 토큰으로 교체한다.
- import는 배럴 우선: `import { theme } from '@/theme'`. 개별 토큰은 `import { colors, spacing } from '@/theme'`.
- 텍스트는 `theme.text.*` 프리셋을 펼쳐 쓰고, 색만 따로 지정한다.

```ts
import { theme } from '@/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface.paper,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  title: {
    ...theme.text.cardTitle,
    color: theme.colors.text.primary,
  },
});
```

## 3. 색상

원시 팔레트는 의미 토큰을 통해서만 노출된다. 주요 의미 그룹:

| 그룹 | 토큰 | 값 | 용도 |
|------|------|-----|------|
| background | `canvas` | `#E5DEC9` | 앱 전체 바탕(도트 질감) |
| surface | `paper` | `#F4EEDD` | 일반 카드 |
| surface | `paperRaised` | `#FCFAF4` | 폴라로이드·떠 있는 카드 |
| surface | `sunken` | `#ECE5D2` | 입력 필드·라인 메모 |
| brand | `primary` | `#B5502D` | 버튼·활성 탭·저장 |
| brand | `primaryPressed` | `#9C4426` | press 상태 |
| feedback | `success` | `#2F7D4F` | 컨펌·변환 완료 |
| feedback | `warning` | `#BE7A35` | 주의 진행 |
| confidence | `high/medium/low` | green/amber/terra | 결정 추출 확신도 |
| text | `primary` | `#2C2823` | 본문 |
| text | `secondary` | `#6F685A` | 보조 |
| text | `tertiary` | `#9A9281` | 타임스탬프·플레이스홀더 |
| accent | `tagBg` | `#F3DE72` | 스티키 태그(할일/약속) |
| accent | `highlight` / `highlightSet` | yellow 외 5색 | 형광펜(기본 yellow + 핑크·초록·블루·오렌지). `Highlight`가 색·두께·모양 변주. 헤더는 `vary` 키로 **날마다·실행마다 무작위**(`@/lib/variation`, 렌더 중엔 고정) |
| accent | `tape` / `tapeSet` | teal 외 5색 | 마스킹 테이프(기본 teal + washi 색 세트: 블러시·버터·페리윙클·세이지) |
| accent | `pin` / `pinSet` | red 외 5색 | 압정(푸시핀) — 광택 머리 + 금속 바늘, `vary`로 색·기울기 변주(red·blue·green·amber·purple) |
| accent | `sticky` / `stickySet` | yellow 외 4색 | 포스트잇(스티키 메모) 배경. `vary`로 색·기울임 변주(노랑·핑크·블루·세이지) |
| accent | `noteFold` | ink 10% | 포스트잇 접힌 모서리(dog-ear) 음영 |
| accent | `noteMargin` | clay | 라인 노트 좌측 마진 세로선(바랜 빨강) |
| border | `rule` | ink 10% | 라인 노트 가로 괘선(옅은 잉크) |
| media | `cameraBg/thumbSlate/thumbNavy` | slate 계열 | 카메라·영상 썸네일 |

**신뢰도 매핑.** 결정 추출 확신도(%)는 임계값으로 색을 고른다: `high` ≥ 85, `medium` 60–84, `low` < 60. 막대 미채움 구간은 `confidence.track`. 수치 텍스트는 동일 색을 재사용해 색+숫자 이중 표기한다.

## 4. 타이포그래피

두 패밀리로 위계를 만든다.

- **display** — 손글씨/스크립트. 제목·날짜·워드마크(예: "Inbox", "5월 13일", "Vault").
- **body** — 산세리프. 본문·라벨·버튼·캡션.

| 프리셋 | 크기/행간 | 패밀리·굵기 | 용례 |
|--------|-----------|-------------|------|
| `displayLarge` | 34/40 | display · bold | 강조용 대제목(환영 등 제한적) |
| `displayCompact` | 26/32 | display · bold | 탭/화면 헤더("Inbox", "Archive", "설정", 날짜) |
| `displayMedium` | 28/34 | display · bold | 스크립트 제목·통계 타일 값 |
| `cardTitle` | 24/30 | body · bold | 카드 제목 |
| `titleMedium` | 20/26 | body · semibold | 섹션 소제목 |
| `bodyLarge` | 17/26 | body · regular | 본문 강조 |
| `bodyMedium` | 15/22 | body · regular | 본문·인용 |
| `bodySmall` | 13/18 | body · regular | 보조 본문 |
| `button` | 17/26 | body · semibold | 버튼 라벨 |
| `caption` | 12/16 | body · medium | 타임스탬프·상태·출처 |
| `tag` | 12/16 | body · bold | 스티키 태그 |

## 5. 폰트 (커스텀 2종) — 로드 완료

토큰의 `fontFamily.display` / `fontFamily.body`는 **로드된 폰트 패밀리 이름**이며, 이미 `@expo-google-fonts`로 로드되어 있다(별도 폰트 파일 불필요):

- display: **Gaegu**(`@expo-google-fonts/gaegu`, `Gaegu_700Bold`) — 한글+영문 손글씨.
- body: **Noto Sans KR**(`@expo-google-fonts/noto-sans-kr`, `NotoSansKR_400/500/600/700`) — 한글 산세리프.

로드 지점은 `app/_layout.tsx`의 `useFonts`(폰트 정의는 `src/theme/fonts.ts`)이며, 로드 완료 전까지 스플래시를 유지한다. 폰트 미로드 시 RN 시스템 폰트로 자연 폴백된다.

유지보수: 폰트를 교체하려면 `src/theme/typography.ts`의 `fontFamily` 상수와 `fonts.ts`의 등록만 수정하면 되고, 컴포넌트는 항상 프리셋 경유로만 폰트를 적용한다(직접 `fontFamily` 지정 금지).

> ⚠️ Expo SDK 55는 학습 데이터보다 최신이다. `expo-font` API는 https://docs.expo.dev/versions/v55.0.0/sdk/font/ 에서 확인할 것.

## 6. 간격·형태·고도

- **Spacing**(4px 기준): `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 40 · 5xl 56`. 화면 좌우 기본 여백은 `layout.screenPaddingX`(20).
- **Radius**: `sm 8`(태그) · `md 12`(입력) · `lg 16`(카드 기본) · `xl 20`(시트) · `pill`(토글).
- **Shadow**: `card`(일반) · `raised`(폴라로이드) · `floating`(녹화/FAB) · `pin`(압정). iOS shadow* + Android elevation 동시 포함.
- **터치**: 모든 인터랙티브 요소 최소 `layout.minTouch`(44).
- **Border(역할별)**: 카드 경계 `border.card`(또렷한 종이 톤 `#A99E80`), 점선·구분선 `border.dashed`(잉크 톤 펜선 `#8B8169`), `border.hairline`(0.16). 원칙: **종이 카드는 부드러운 경계+그림자+데클**로, **선·점선·컨트롤(화살표 버튼 등)은 잉크처럼 또렷하게** — "종이 위에 펜으로 그린" 다이어리 느낌.

## 7. 모션

스와이프 카드·시트 전환에 사용. `duration`: `fast 150 · base 250 · slow 400`. `easing`: `standard`(기본 이동), `decelerate`(등장), `accelerate`(퇴장). `spring`: `soft`(안착·복귀) · `bouncy`(컨펌·성공) · `stiff`(press). Inbox 스와이프-덱과 시트 슬라이드는 `base + standard`를 기준으로 한다.

**공용 모션 프리미티브(core RN Animated, 네이티브 드라이버).** `src/components/ui`: `PressableScale`(press 스프링+선택 햅틱) · `LiftPressable`(롱프레스 시 집어드는 lift+`impact` 햅틱 → 빠른 액션 시트) · `AppearIn`(마운트 페이드+슬라이드, `index` stagger) · `Pulse`(맥동, `maxScale`로 강도). **동작 줄이기(reduce motion)** 시 자동 비활성 — `@/lib/motion`의 `useReducedMotion()`/`prefersReducedMotion()`, `layoutAnimate`도 존중. 적용: 캡처 버튼(press) · Today/Inbox 리스트(stagger·저장 안착) · 녹화 표시등(`Pulse`) · 탭 전환(crossfade) · STT/압축 상태(맥동·페이드인) · 로딩 스켈레톤(`Shimmer`) · 당겨서 새로고침(Today·Inbox·Archive, 고무줄+`tap`) · 음성 파형(`LevelMeter`, 실시간 metering) · 카드 롱프레스 빠른 액션(EntryCard — 열기·삭제, `LiftPressable`+`ActionSheet`, 삭제는 소프트 ADR-014). 신규 reanimated 워클릿이 필요하면 `react-native-worklets/plugin`(babel) + 리빌드 필요(현재는 미사용).

**레이아웃 모션 단일 진입점.** 리스트 펼침/접힘·세그먼트 전환 등 next-layout 애니메이션은 `@/lib/motion`의 `layoutAnimate()`로 통일한다(토큰 `duration` 사용, 인라인 `configureNext`·매직넘버 금지). RN `Animated` 기반 모션(예: DecisionDeck 스와이프)은 `duration.base` 등 토큰을 직접 참조한다. 모달은 native `animationType`을 쓰며 시트=slide·다이얼로그=fade로 일관한다.

**촉각(haptics) 단일 진입점.** 촉각 피드백은 `@/lib/haptics`의 의미 어휘를 쓴다(raw `expo-haptics` 호출 금지). 어휘·용례: `impact`(녹화 시작/정지) · `tap`(일시정지/재개 등 토글) · `selection`(체크·칩·세그먼트 선택) · `success`(저장·컨펌·완료) · `warning`(기각·삭제) · `error`(실패). **과용 금지** — 의미 있는 확정에만 쓴다. `expo-haptics`(설치 완료) 실호출 — 라이브. 발화 지점 배선: 녹화 시작/정지·일시정지·저장·컨펌·기각·토글·캡처 버튼.

## 8. 코어 컴포넌트 명세

### 8.1 탭바
4탭(Today / Archive / Inbox / Settings). 활성 탭은 `brand.primary` 아이콘+라벨, 비활성은 `text.tertiary`. Inbox는 미확인 건수 배지(`accent.pin` 원형 배경, `text.onPrimary` 숫자). 배경 `surface.paper`, 상단 `border.hairline`.

### 8.2 폴라로이드 / 모먼트 카드
`surface.paperRaised` 프레임 + `heavy` 보더 느낌의 흰 여백, `raised` 그림자, `layout.polaroidTilt` 기울임(장식 시 ±2°). 미디어 영역은 `media.thumbSlate/thumbNavy`. 우하단 길이 캡슐(`media.durationPillBg` + `text.onMedia`, `caption`). 좌상단 타입 아이콘(영상/음성). 테이프 장식은 `accent.tape`. **가장자리는 찢긴 종이(deckle)** — 프레임 뒤에 같은 종이색 SVG를 깔고 `feDisplacementMap`으로 불규칙 변위(`deckle` prop 기본 on, 그림자·레이아웃 유지, 필터 미지원 시 일반 프레임으로 degrade).

**테이프 변형.** `Tape`는 색(`accent.tapeSet`)과 표면 질감(`texture`: `plain`·`washi`·`striped`·`grid`·`dots`)을 조합한다. 같은 화면에 여러 장 깔 때는 `TAPE_VARIANTS` 프리셋을 인덱스로 순환해 색·질감·각도·찢김 시드를 자동 변주한다. 찢긴 가장자리는 `feTurbulence`+`feDisplacementMap`(graceful degrade).

**장식 변주.** `Tape`·`Pin`·`EmptyMomentArt`에 `vary` 키를 주면 색·질감·모양·각도(압정은 광택 방향)가 **날마다·실행마다 무작위**로 바뀐다(`@/lib/variation`, 렌더 중엔 고정되어 깜빡임 없음). 적용 현황: Entry 카드(entry.id)·On This Day·타임라인·Inbox 덱·결정 힌트·Today 배너.

### 8.2b 일러스트 슬롯 (placeholder)
빈 상태 일러스트는 `IllustrationSlot`으로 **자리만 잡아두고 나중에 실물로 교체**한다. 렌더 우선순위: `source`(래스터) → `placeholder`(임시 SVG 손그림) → 점선 프레임. **연결 방법**: `source={require('...png')}`만 채우면 끝(개발용 `🖼 name` 태그 자동 제거). 현재 슬롯: `empty-today`(Today) · `inbox-deck`·`inbox-done`(Inbox) · `archive-calendar`·`archive-archive`(Archive).

### 8.3 스티키 태그
카테고리(할일/약속 등) 표시. `accent.tagBg` 배경 + `accent.tagText`, `tag` 프리셋, `radius.sm`, 좌우 `spacing.sm` 패딩. 색은 카테고리별로 고정하되 텍스트를 항상 동반(색각 보조).

### 8.4 신뢰도 막대
가로 트랙(`confidence.track`) + 채움(신뢰도 색). 우측에 동일 색 `%` 수치(`caption`/`titleMedium`). 0–100을 막대 폭에 선형 매핑.

### 8.5 버튼
- **Primary**: `brand.primary` 배경, `text.onPrimary`, `button` 프리셋, `radius.md`. press 시 `brand.primaryPressed`.
- **Secondary**: `surface.sunken`/`paper` 배경, `text.primary`, `border.card`.
- **Quiet/text**: 배경 없음, `text.secondary` 또는 `text.link`.
- 파괴적(기각/결정 아님): `feedback.danger` 텍스트 또는 보더, 채움은 지양.
- **캡처 버튼(붙인 사진 카드)**: Today 캡처 툴바(업로드·음성·영상)는 일반 버튼이 아니라 **붙인 사진 카드** 메타포로 렌더한다 — `surface.paperRaised` 프레임 + `raised` 그림자 + 살짝 기울임 + 위에 붙인 `Tape` + 미디어 톤 썸네일(영상=`brand.primary`, 그 외 `media.thumbSlate`) + 하단 라벨. 영상이 primary(테라코타 썸네일). 구현: `src/components/CaptureBar.tsx`.

### 8.6 입력·라인 메모
`surface.sunken` 배경, `text.primary` 입력, `text.tertiary` 플레이스홀더, `border.card`. 라인 메모(저장 화면)는 밑줄 라인 스타일.

### 8.7 아이콘 (톤 정합)
아이콘은 `@/components/ui`의 `Icon` 컴포넌트(레지스트리)를 단일 진입점으로 쓴다. 화면은 의미 이름(`today`·`video`·`mic`·`close` 등)만 지정하고, 의미→글리프 매핑·기본 크기(`iconSize`)·색(토큰)은 `Icon.tsx` 한 곳에서 관리한다. 추후 톤/세트 교체(예: 손그림 SVG)는 이 파일만 수정한다.

규칙: **기본은 아웃라인(가벼운 종이 톤), 활성/주요 상태만 채움**(`active`). 크기는 `iconSize`(sm 16 · md 20 · lg 24 · tab 26) 토큰, 색은 항상 토큰 경유. 적용 현황: **전면 이전 완료** — 앱 전체에서 `@expo/vector-icons`를 직접 import하는 파일은 `Icon.tsx`(레지스트리) 하나뿐이다. 새 아이콘이 필요하면 `Icon.tsx`의 `IconName`/`REGISTRY`에 의미 이름을 추가한 뒤 사용한다(직접 Ionicons 사용 금지).

### 8.8 토글 / 체크박스
토글: `radius.pill` 트랙, on=`brand.primary` / off=`surface.sunken`. 체크박스: off 보더(`border.card`), on=`brand.primary` 채움 + `text.onPrimary` 체크.

### 8.9 포스트잇 (PostIt)
"붙여둔 메모" 메타포. `accent.sticky`(기본 노랑) 또는 `accent.stickySet`에서 `vary`로 고른 색 배경 + `radius.sm` + `raised` 그림자 + 살짝 기울임(`layout.stickyTilt` ±진폭, `vary`로 메모마다 변주) + 접힌 모서리(dog-ear, 우하단 `accent.noteFold` 삼각형, `peel` prop 기본 on). **검토/관리 모드 카드 표면**으로 쓴다(진행 중 결정·후속 확인 = 포스트잇, 완료행은 차분한 평면 카드로 위계 구분). 색은 토큰 경유. 구현: `src/components/ui/PostIt.tsx`. 적용: `DecisionBoardCard`·`FollowUpCard`(`vary={decision.id}`).

### 8.10 라인 노트 (LinedPaper)
"노트에 손으로 쓴" 메타포. `surface.paperRaised` 종이 + 가로 괘선(`border.rule`, `layout.noteLineGap` 간격, 높이 측정해 줄 수 자동) + 선택적 좌측 빨강 마진(`margin` prop, `accent.noteMargin`) + `card` 그림자 + `border.card` 경계. SVG/필터 없이 가벼운 `View` 타일로 괘선을 깐다. **일기 모드의 메모/음성 카드 표면**으로 쓴다. 구현: `src/components/ui/LinedPaper.tsx`. 적용: `EntryDiaryItem`(텍스트·음성 항목).

## 9. 화면별 모드

### 9.1 Inbox — 2가지 보기 모드
검토 대기 결정을 다루는 탭. 두 모드를 모두 지원한다.

- **스와이프-덱 모드**: 카드 1장을 크게 띄우고 뒤에 스택이 비치는 형태. 상단 진행 표시(`1 / 3`), 압정 장식, 하단 액션 3종(`기각`(좌)·`수정`(원형, secondary)·`컨펌`(원형, primary)). 좌우 스와이프로 기각/컨펌. 모션은 `base + standard`.
- **리스트 모드**: 카드를 세로로 나열. 각 카드에 태그·신뢰도 막대·인용·출처·인라인 액션(`결정 아님`·`수정`·`컨펌`). 섹션 헤더("검토 대기 · N건").

두 모드는 동일한 결정 데이터·동일 액션을 공유하며 레이아웃만 다르다. 보기 모드 상태는 Inbox store에 둔다(토큰/컴포넌트는 공유).

### 9.2 Today — 보기 모드 + 수정 모드
하루의 클립을 모은 일기 탭(현 코드의 `ViewMode = 'list' | 'diary'`와 연계).

- **보기 모드**: 캡처 툴바(업로드/음성/영상, 활성=`brand.primary`), "오늘 한 줄" 입력, 결정 발견 배너(점선 `border.dashed` + `accent.highlight` 계열 배경, 압정), 클립 카드 리스트.
- **수정 모드**: 동일 항목을 편집 가능 상태로. 제목/본문 인라인 편집, 정렬·삭제 등. 보기↔수정 전환은 헤더 액션으로 노출하고, 색·간격 토큰은 보기 모드와 공유한다.

## 10. 적용 로드맵(권장 순서)

1. ~~**폰트 로드** — `_layout.tsx`에 `useFonts` 추가, 스플래시 연동.~~ ✅ 완료(Gaegu · Noto Sans KR).
2. **공용 프리미티브** — `Text`/`Button`/`Card`/`Tag`/`Pin`을 토큰 기반으로 `src/components`에 정리.
3. **화면 리팩터** — Today → Inbox(2모드) → Archive → Settings → 카메라/프리뷰(media 토큰) 순으로 하드코딩 색 제거.
4. **회귀 확인** — 화면별 `npx tsc --noEmit` + 에뮬레이터 시각 확인.

> 본 문서/토큰 변경은 ADR 결정과 충돌 시 질문 후 ADR을 갱신한다(CLAUDE.md 규칙).
