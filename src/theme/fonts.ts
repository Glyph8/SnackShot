/**
 * 폰트 에셋 맵 — expo-font `useFonts`에 전달한다.
 *
 * ⚠️ 현재 비어 있어 시스템 폰트로 폴백된다(앱 정상 동작).
 *    실제 손글씨/산세리프를 적용하려면:
 *      1) `assets/fonts/`에 폰트 파일을 넣고 (assets/fonts/README.md 참조)
 *      2) 아래 require 주석을 해제한 뒤
 *      3) key가 `typography.ts`의 `fontFamily` 값과 일치하는지 확인한다.
 *
 *    require()는 실제 파일이 있을 때만 추가할 것(없는 경로 require는 번들 에러).
 */
export const fontAssets: Record<string, number> = {
  // Gaegu: require('../../assets/fonts/Gaegu-Bold.ttf'),
  // Pretendard: require('../../assets/fonts/Pretendard-Regular.otf'),
};

/** 로드할 폰트가 하나라도 있으면 true */
export const hasBundledFonts = Object.keys(fontAssets).length > 0;
