/**
 * SnackShot 타이포그래피 토큰.
 *
 * 폰트 2종 체계:
 *  - display: 손글씨/스크립트 느낌(제목·날짜·브랜드 워드마크). 한글+영문 지원.
 *  - body: 깔끔한 한글 산세리프(본문·UI 라벨·버튼).
 *
 * ⚠️ fontFamily 값은 expo-font로 로드한 **폰트 패밀리 이름**이다.
 *   실제 폰트 파일(.ttf/.otf)을 assets/fonts에 추가하고 useFonts로 로드해야 한다.
 *   도입 가이드는 SnackShot-DesignSystem.md "폰트" 절 참조.
 *   폰트 로드 전 fallback은 RN 시스템 폰트(undefined)로 처리한다.
 */

/** 권장 폰트 — 교체 시 이 상수만 수정 */
export const fontFamily = {
  /** 디스플레이/스크립트 (예: Gaegu, Nanum Pen Script) */
  display: 'Gaegu',
  /** 본문 산세리프 (예: Pretendard) */
  body: 'Pretendard',
} as const;

/** RN fontWeight 리터럴 */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** 타입 스케일 (px) */
export const fontSize = {
  micro: 11,
  caption: 12, // 타임스탬프·태그·상태
  bodySm: 13,
  bodyMd: 15, // 본문 기본
  bodyLg: 17,
  titleMd: 20,
  titleLg: 24, // 카드 제목
  displayMd: 28, // 스크립트 제목(Inbox, 5월)
  displayLg: 34, // 화면 대제목(설정, 오늘의 일기)
} as const;

/** 라인 높이 (px, 절대값) */
export const lineHeight = {
  micro: 16,
  caption: 16,
  bodySm: 18,
  bodyMd: 22,
  bodyLg: 26,
  titleMd: 26,
  titleLg: 30,
  displayMd: 34,
  displayLg: 40,
} as const;

export const letterSpacing = {
  tight: -0.2,
  normal: 0,
  wide: 0.5, // 라벨/캡션 대문자
} as const;

/**
 * 텍스트 프리셋 — 컴포넌트에서 바로 펼쳐 쓰는 스타일 묶음.
 *   <Text style={textPresets.cardTitle}>…</Text>
 */
export const textPresets = {
  /** 화면 대제목 (설정 / 오늘의 일기) */
  displayLarge: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.displayLg,
    lineHeight: lineHeight.displayLg,
    fontWeight: fontWeight.bold,
  },
  /** 스크립트 제목 (Inbox / 5월 / 날짜) */
  displayMedium: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.displayMd,
    lineHeight: lineHeight.displayMd,
    fontWeight: fontWeight.bold,
  },
  /** 카드 제목 */
  cardTitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.titleLg,
    lineHeight: lineHeight.titleLg,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  /** 섹션/소제목 */
  titleMedium: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.titleMd,
    lineHeight: lineHeight.titleMd,
    fontWeight: fontWeight.semibold,
  },
  /** 본문 강조 */
  bodyLarge: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.bodyLg,
    lineHeight: lineHeight.bodyLg,
    fontWeight: fontWeight.regular,
  },
  /** 본문 기본 (트랜스크립트 인용 등) */
  bodyMedium: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.bodyMd,
    lineHeight: lineHeight.bodyMd,
    fontWeight: fontWeight.regular,
  },
  /** 보조 본문 */
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.bodySm,
    lineHeight: lineHeight.bodySm,
    fontWeight: fontWeight.regular,
  },
  /** 버튼 라벨 */
  button: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.bodyLg,
    lineHeight: lineHeight.bodyLg,
    fontWeight: fontWeight.semibold,
  },
  /** 캡션 (타임스탬프 · 상태 · 출처) */
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.medium,
  },
  /** 태그 (할일 / 약속) */
  tag: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
} as const;

export type FontFamily = typeof fontFamily;
export type TextPresets = typeof textPresets;
export type TextPresetKey = keyof typeof textPresets;
