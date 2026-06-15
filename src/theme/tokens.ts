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
  sand050: '#FCFAF4', // 폴라로이드 프레임 등 가장 밝은 종이
  sand100: '#F4EEDD', // 카드 표면
  sand200: '#ECE5D2', // 입력 필드·sunken 표면
  sand300: '#E5DEC9', // 앱 캔버스 배경(도트 텍스처 바탕)
  sand400: '#DAD2BB', // 카드 테두리·구분선
  sand500: '#C9C0A8', // 점선 구분선·비활성 트랙

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
  yellow200: '#F5E27D', // 하이라이트 마커 배경
  teal300: '#9FD3C2', // 마스킹 테이프
  red500: '#D6463C', // 압정(push pin)

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
    success: palette.green600,
    link: palette.terra500,
  },
  /** 경계·구분 */
  border: {
    card: palette.sand400,
    hairline: 'rgba(44, 40, 35, 0.08)',
    dashed: palette.sand500,
    focus: palette.terra500,
  },
  /** 장식 액센트 */
  accent: {
    tagBg: palette.yellow300, // 스티키 태그(할일/약속)
    tagText: palette.ink900,
    highlight: palette.yellow200, // 본문 형광펜
    tape: palette.teal300, // 마스킹 테이프
    pin: palette.red500, // 압정
    pinGloss: 'rgba(255, 255, 255, 0.45)', // 압정 광택 하이라이트
  },
  /** 어두운 미디어 표면(카메라/영상) */
  media: {
    cameraBg: palette.slate900,
    thumbSlate: palette.slate700,
    thumbNavy: palette.slate800,
    durationPillBg: 'rgba(0, 0, 0, 0.55)',
    controlScrim: 'rgba(0, 0, 0, 0.45)',
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
  /** 탭바 높이(safe-area 제외) */
  tabBarHeight: 56,
  /** 폴라로이드 회전 각도(장식) */
  polaroidTilt: -2,
  /** 카드 최대 폭(태블릿 대비) */
  contentMaxWidth: 520,
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Shadow = typeof shadow;
