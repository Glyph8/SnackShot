# 폰트 추가 가이드

SnackShot은 2종 폰트를 쓴다. 현재 이 폴더가 비어 있어 **시스템 폰트로 폴백** 중이다(앱은 정상 동작). 아래 중 한 방법으로 실제 폰트를 적용한다.

| 역할 | 토큰 키 (`typography.ts`) | 권장 폰트 | 라이선스 |
|------|---------------------------|-----------|----------|
| display(손글씨) | `Gaegu` | Gaegu | OFL |
| body(산세리프) | `Pretendard` | Pretendard | OFL |

## 방법 A — 폰트 파일 직접 추가 (권장: 디자인 의도 그대로)

1. 폰트 파일을 이 폴더에 둔다:
   - `Gaegu-Bold.ttf` (Google Fonts: Gaegu)
   - `Pretendard-Regular.otf` / 필요 시 `Pretendard-Bold.otf` (Pretendard 릴리스)
2. `src/theme/fonts.ts`에서 require 주석을 해제한다:

   ```ts
   export const fontAssets: Record<string, number> = {
     Gaegu: require('../../assets/fonts/Gaegu-Bold.ttf'),
     Pretendard: require('../../assets/fonts/Pretendard-Regular.otf'),
   };
   ```

3. 굵기별 파일을 따로 쓸 경우 별도 key로 등록하고(`'Pretendard-Bold'` 등),
   `typography.ts`의 프리셋 `fontFamily`/`fontWeight` 매핑을 조정한다.

## 방법 B — @expo-google-fonts 패키지 (설치만으로 적용)

Pretendard는 Google Fonts에 없어 body는 대체 한글 산세리프를 쓴다(예: Noto Sans KR, IBM Plex Sans KR).

```bash
npx expo install @expo-google-fonts/gaegu @expo-google-fonts/noto-sans-kr
```

```ts
// src/theme/fonts.ts
import { Gaegu_700Bold } from '@expo-google-fonts/gaegu';
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr';

export const fontAssets = {
  Gaegu: Gaegu_700Bold,
  Pretendard: NotoSansKR_400Regular, // 대체 body 폰트
};
```

> body를 Noto Sans KR로 바꿀 경우, `typography.ts`의 `fontFamily.body` 주석만 갱신하면 컴포넌트 변경은 불필요하다(키 이름 `Pretendard` 유지 시).

## 적용 후 확인

- `app/_layout.tsx`가 `useFonts(fontAssets)`로 로드 → 완료 전 로딩 표시.
- Expo SDK 55 expo-font API: https://docs.expo.dev/versions/v55.0.0/sdk/font/
- 적용 확인은 에뮬레이터에서 제목(손글씨)·본문(산세리프) 대비로.
