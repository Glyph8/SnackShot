# 폰트 적용 가이드

SnackShot은 2종 폰트를 쓴다 — display(손글씨)=**Gaegu**, body(산세리프)=**Noto Sans KR**.
현재는 폰트 미로드 상태로 **시스템 폰트로 폴백**(앱 정상 동작) 중이다.

채택 경로: `@expo-google-fonts` (파일 다운로드 불필요). 아래 3단계로 끝난다.

## 1) 패키지 설치 (네트워크 필요)

```bash
npx expo install @expo-google-fonts/gaegu @expo-google-fonts/noto-sans-kr
```

## 2) `src/theme/fonts.ts` 주석 해제

import 2줄과 `fontAssets`의 6개 항목 주석을 푼다:

```ts
import { Gaegu_400Regular, Gaegu_700Bold } from '@expo-google-fonts/gaegu';
import {
  NotoSansKR_400Regular, NotoSansKR_500Medium,
  NotoSansKR_600SemiBold, NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';

export const fontAssets: Record<string, number> = {
  Gaegu_400Regular, Gaegu_700Bold,
  NotoSansKR_400Regular, NotoSansKR_500Medium,
  NotoSansKR_600SemiBold, NotoSansKR_700Bold,
};
```

## 3) 끝 — 재시작

`app/_layout.tsx`가 `useFonts(fontAssets)`로 로드하고 완료 전 로딩 표시를 띄운다.
`npx expo start -c`로 캐시를 비우고 재시작하면 적용된다.

## 매핑 구조 (참고)

`typography.ts`의 `fontFamily` 상수가 위 key 이름과 1:1로 연결된다 — 패밀리에 가중치가 내장돼 있다.

| 역할 | 패밀리 key | 쓰이는 프리셋 |
|------|-----------|---------------|
| display | `Gaegu_700Bold` | displayLarge/Medium, 캘린더 월 제목 |
| body 400 | `NotoSansKR_400Regular` | bodyLarge/Medium/Small |
| body 500 | `NotoSansKR_500Medium` | caption |
| body 600 | `NotoSansKR_600SemiBold` | titleMedium, button |
| body 700 | `NotoSansKR_700Bold` | cardTitle, tag, micro |

폰트를 바꾸려면 `typography.ts`의 `fontFamily` 값과 `fonts.ts`의 key만 새 패밀리로 교체하면 된다.

## 대안

- body를 더 기하학적으로: `@expo-google-fonts/ibm-plex-sans-kr` 설치 후 key를 `IBMPlexSansKR_*`로 교체.
- display 손글씨 대안: `@expo-google-fonts/nanum-pen-script`(단일 weight) — 이 경우 display 1종만 등록.
- Pretendard(목업 원안)는 Google Fonts에 없어 .otf 파일을 직접 `assets/fonts/`에 넣고 `require()`로 등록해야 한다.
