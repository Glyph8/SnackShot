/**
 * SnackShot 디자인 토큰 — Light / Paper 테마 (단일 테마, ADR 부록: Design System).
 *
 * 2계층 구조:
 *  1) `palette` — 원시 색상값. **컴포넌트에서 직접 import 금지.** semantic 토큰 경유.
 *  2) semantic 토큰(`colors` 등) — 의미 기반. 컴포넌트는 이쪽만 참조.
 *
 * 카메라/프리뷰 등 어두운 미디어 표면은 `colors.media.*`로 별도 수용한다(다크 테마 아님).
 * 폰트는 typography.ts 참조.
 */

// ─────────────────────────────────────────────────────────────
// 1. Primitive palette (raw — 직접 사용 금지)
// ─────────────────────────────────────────────────────────────
const palette = {
  // 종이/모래 계열 (배경·표면)
  paper000: '#FDFDF9', // 보고서 등 가장 흰 종이 시트
  sand050: '#FCFAF4', // 폴라로이드 프레임 등 가장 밝은 종이
  sand100: '#F4EEDD', // 카드 표면
  sand200: '#ECE5D2', // 입력 필드·sunken 표면
  sand300: '#E5DEC9', // 앱 캔버스 배경(도트 텍스처 바탕)
  sand400: '#DAD2BB', // 옅은 구분선
  sand500: '#C9C0A8', // 점선 구분선·비활성 트랙
  sand600: '#A99E80', // 카드 테두리(또렷한 종이 경계)
  sand700: '#8B8169', // 점선·구분선(잉크 톤 — 펜으로 그은 선)

  // 잉크(텍스트) 계열
  ink900: '#2C2823', // 본문 기본 텍스트
  ink600: '#6F685A', // 보조 텍스트
  ink400: '#9A9281', // 타임스탬프·플레이스홀더
  ink000: '#FDF8EC', // 어두운/브랜드 표면 위 텍스트

  // 브랜드 테라코타
  terra500: '#B5502D', // 기본 브랜드(버튼·활성 탭·저장)
  terra600: '#9C4426', // press 상태
  terra100: '#F0D9CC', // 매우 옅은 틴트

  // 의미 색
  green600: '#2F7D4F', // 성공·컨펌·높은 신뢰도
  green700: '#266A42', // green press
  green100: '#CFE3D3', // 진행 트랙 채움(옅음)
  amber500: '#BE7A35', // 중간 신뢰도·주의 진행
  amber100: '#EAD6B4',

  // 액센트(장식)
  yellow300: '#F3DE72', // 스티키 태그 배경
  yellow200: '#F5E27D', // 하이라이트 마커 배경(기본)
  teal300: '#9FD3C2', // 마스킹 테이프(기본)
  red500: '#D6463C', // 압정(push pin) 기본

  // 압정 머리 색 세트 (선명한 핀 톤)
  pinBlue: '#3F7DBE',
  pinGreen: '#3E9E6B',
  pinAmber: '#E0A33A',
  pinPurple: '#8A6BBF',

  // 형광펜 색 세트 (헤더·강조 — 옅고 형광 톤)
  hlPink: '#F4A9BC',
  hlGreen: '#AEDD9A',
  hlBlue: '#9FCFE8',
  hlOrange: '#F7C68C',

  // washi 테이프 색 세트 (장식 — 차분·종이 친화 톤)
  rose300: '#E3B3A4', // 블러시
  butter300: '#E9D79A', // 버터(스티키 태그와 구분되는 옅은 머스터드)
  peri300: '#B4BDDB', // 페리윙클(옅은 청보라)
  sage300: '#BCC8A4', // 세이지(옅은 녹)

  // 미디어(어두운 표면 — 카메라/영상 플레이스홀더)
  slate900: '#1A1A1A', // 카메라 배경
  slate800: '#2B333C', // 영상 썸네일(네이비)
  slate700: '#3A463F', // 영상 썸네일(슬레이트 그린)

  // 절대값
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ─────────────────────────────────────────────────────────────
// 2. Semantic colors
// ─────────────────────────────────────────────────────────────
export const colors = {
  /** 화면 배경 */
  background: {
    canvas: palette.sand300, // 앱 전체 바탕
    canvasAlt: palette.sand200,
  },
  /** 표면(카드·시트·입력) */
  surface: {
    paper: palette.sand100, // 일반 카드
    paperRaised: palette.sand050, // 폴라로이드/떠 있는 카드
    sheet: palette.paper000, // 가장 흰 종이 시트(보고서 문서)
    sunken: palette.sand200, // 입력 필드·메모(라인) 배경
    overlayScrim: 'rgba(28, 24, 18, 0.45)', // 모달/시트 뒤 스크림
  },
  /** 브랜드(주요 액션) */
  brand: {
    primary: palette.terra500,
    primaryPressed: palette.terra600,
    tint: palette.terra100,
    onPrimary: palette.ink000,
  },
  /** 피드백(상태) */
  feedback: {
    success: palette.green600,
    successPressed: palette.green700,
    successTrack: palette.green100,
    warning: palette.amber500,
    warningTrack: palette.amber100,
    danger: palette.terra500, // 파괴적 액션은 브랜드와 동일 계열
  },
  /** 차트 카테고리 색 — 시인성을 위한 구분용 팔레트(범례와 1:1). 막대/도넛/라인 공용. */
  chart: {
    c1: palette.terra500, // 1순위(원본·미백업 등 강조)
    c2: palette.green600,  // 압축본·백업됨 등 긍정
    c3: palette.amber500,  // 중간 단계
    c4: palette.teal300,   // 보조
    c5: palette.slate700,  // 짙은 보조
    c6: palette.sand500,   // 미사용·기타(차분)
    track: palette.sand300, // 미채움 트랙
  },
  /** 신뢰도(결정 추출 확신도) */
  confidence: {
    high: palette.green600, // ≥ 85%
    medium: palette.amber500, // 60–84%
    low: palette.terra500, // < 60%
    track: palette.sand500, // 진행바 미채움
  },
  /** 텍스트 */
  text: {
    primary: palette.ink900,
    secondary: palette.ink600,
    tertiary: palette.ink400,
    onPrimary: palette.ink000, // 브랜드 표면 위
    onMedia: palette.white, // 어두운 미디어 위
    onMediaMuted: 'rgba(255, 255, 255, 0.7)',
    /** 포스트잇(밝은 파스텔 메모) 위 — 어떤 sticky 색에서도 읽히는 진한 잉크 위계 */
    onSticky: palette.ink900,
    onStickyMuted: 'rgba(44, 40, 35, 0.74)',
    onStickyFaint: 'rgba(44, 40, 35, 0.55)',
    success: palette.green600,
    link: palette.terra500,
  },
  /** 경계·구분 */
  border: {
    card: palette.sand600, // 또렷한 카드 경계
    hairline: 'rgba(44, 40, 35, 0.16)',
    dashed: palette.sand700, // 잉크 톤 점선(펜 선 느낌)
    rule: 'rgba(44, 40, 35, 0.24)', // 라인 노트 가로 괘선(잉크 — 글 아래로 보이게)
    focus: palette.terra500,
  },
  /** 장식 액센트 */
  accent: {
    tagBg: palette.yellow300, // 스티키 태그(할일/약속)
    tagText: palette.ink900,
    highlight: palette.yellow200, // 본문 형광펜(기본)
    /** 형광펜 색 세트 — 헤더 등 강조에 색 변주로 사용 */
    highlightSet: [palette.yellow200, palette.hlPink, palette.hlGreen, palette.hlBlue, palette.hlOrange],
    tape: palette.teal300, // 마스킹 테이프(기본)
    /** washi 테이프 색 세트 — 다양한 색의 테이프를 깔 때 인덱스로 순환 사용 */
    tapeSet: [palette.teal300, palette.rose300, palette.butter300, palette.peri300, palette.sage300],
    pin: palette.red500, // 압정(기본)
    /** 압정 머리 색 세트 — vary로 핀마다 색 변주 */
    pinSet: [palette.red500, palette.pinBlue, palette.pinGreen, palette.pinAmber, palette.pinPurple],
    pinGloss: 'rgba(255, 255, 255, 0.45)', // 압정 광택 하이라이트
    /** 포스트잇(스티키 메모) 기본 색 */
    sticky: palette.yellow300,
    /** 포스트잇 색 세트 — vary로 메모마다 색 변주(노랑·핑크·블루·세이지) */
    stickySet: [palette.yellow300, palette.hlPink, palette.hlBlue, palette.sage300],
    /** 포스트잇 접힌 모서리(dog-ear) 음영 — 종이 위에 겹쳐 어둡게 */
    noteFold: 'rgba(44, 40, 35, 0.10)',
  },
  /** 어두운 미디어 표면(카메라/영상) */
  media: {
    cameraBg: palette.slate900,
    thumbSlate: palette.slate700,
    thumbNavy: palette.slate800,
    durationPillBg: 'rgba(0, 0, 0, 0.55)',
    controlScrim: 'rgba(0, 0, 0, 0.45)',
    surfaceTint: 'rgba(255, 255, 255, 0.12)', // 어두운 화면 위 반투명 칩
    recordDot: palette.red500, // 녹화 표시등
  },
} as const;

// ─────────────────────────────────────────────────────────────
// 3. Spacing (4px base)
// ─────────────────────────────────────────────────────────────
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

// ─────────────────────────────────────────────────────────────
// 4. Radius
// ─────────────────────────────────────────────────────────────
export const radius = {
  none: 0,
  xs: 4, // 미니 카드·작은 칩
  sm: 8, // 태그·작은 버튼
  md: 12, // 입력·중간 버튼
  lg: 16, // 카드 기본
  xl: 20, // 시트·큰 카드
  pill: 999, // 토글·캡슐
} as const;

// ─────────────────────────────────────────────────────────────
// 5. Border width
// ─────────────────────────────────────────────────────────────
export const borderWidth = {
  hairline: 0.5,
  thin: 1,
  thick: 1.5,
  heavy: 4, // 폴라로이드 프레임 등
} as const;

// ─────────────────────────────────────────────────────────────
// 6. Shadow (RN: iOS shadow* + Android elevation)
// ─────────────────────────────────────────────────────────────
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** 일반 카드 */
  card: {
    shadowColor: palette.black,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** 폴라로이드·떠 있는 카드 */
  raised: {
    shadowColor: palette.black,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  /** FAB·녹화 버튼 등 floating */
  floating: {
    shadowColor: palette.black,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  /** 압정 — 작고 단단한 그림자 */
  pin: {
    shadowColor: palette.black,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
} as const;

// ─────────────────────────────────────────────────────────────
// 7. Opacity
// ─────────────────────────────────────────────────────────────
export const opacity = {
  pressed: 0.7,
  disabled: 0.4,
  muted: 0.6,
  scrim: 0.45,
} as const;

// ─────────────────────────────────────────────────────────────
// 8. Motion (애니메이션 — 스와이프 카드/시트)
// ─────────────────────────────────────────────────────────────
export const duration = {
  instant: 100,
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export const easing = {
  /** 표준 진입/이동 */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  /** 감속(요소 등장) */
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  /** 가속(요소 퇴장) */
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

/** 스프링 프리셋 — RN Animated.spring 설정값(useNativeDriver와 함께 사용). */
export const spring = {
  /** 부드럽게 안착(등장·복귀) */
  soft: { stiffness: 180, damping: 18, mass: 1 },
  /** 통통 튀는 강조(컨펌·성공) */
  bouncy: { stiffness: 220, damping: 12, mass: 1 },
  /** 빠르고 단단한 반응(press) */
  stiff: { stiffness: 320, damping: 24, mass: 1 },
} as const;

// ─────────────────────────────────────────────────────────────
// 9. Icon size
// ─────────────────────────────────────────────────────────────
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  tab: 26,
} as const;

// ─────────────────────────────────────────────────────────────
// 10. Layout (구조 상수)
// ─────────────────────────────────────────────────────────────
export const layout = {
  /** 최소 터치 영역(접근성) */
  minTouch: 44,
  /** 화면 좌우 기본 여백 */
  screenPaddingX: spacing.xl,
  /** 탭 화면 상단(타이틀) 공통 여백 — 탭 전환 시 위치 통일 */
  headerPaddingTop: spacing.lg,
  /** 탭바 높이(safe-area 제외) */
  tabBarHeight: 56,
  /** 일부 edge-to-edge 기기에서 insets.bottom이 0으로 잡힐 때 보장할 최소 하단 여백 */
  navBarFallback: 24,
  /** 폴라로이드 회전 각도(장식) */
  polaroidTilt: -2,
  /** 포스트잇 기본 기울임 진폭(±도) — vary로 메모마다 변주 */
  stickyTilt: 2.5,
  /** 라인 노트 괘선 간격(px) */
  noteLineGap: 28,
  /** 카드 최대 폭(태블릿 대비) */
  contentMaxWidth: 520,
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Shadow = typeof shadow;
