# `@/theme` 사용 가이드

SnackShot 디자인 토큰. 전체 시스템 설명은 루트 `SnackShot-DesignSystem.md` 참조. 이 문서는 **코드에서 쓰는 법**에 집중한다.

## 파일 구성

| 파일 | 내용 |
|------|------|
| `tokens.ts` | 원시 `palette`(내부 전용) → semantic `colors`, `spacing`, `radius`, `borderWidth`, `shadow`, `opacity`, `duration`, `easing`, `iconSize`, `layout` |
| `typography.ts` | `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `textPresets` |
| `index.ts` | 배럴: `theme` 객체 + `Theme` 타입 + 개별 토큰 재export |

## 임포트 패턴

```ts
// 통합 객체 (권장)
import { theme } from '@/theme';
theme.colors.surface.paper;
theme.spacing.lg;
...theme.text.cardTitle;

// 개별 토큰
import { colors, spacing, textPresets } from '@/theme';
```

## 표준 사용 예

```ts
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface.paper,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border.card,
    ...theme.shadow.card,
  },
  title: {
    ...theme.text.cardTitle,
    color: theme.colors.text.primary,
  },
  meta: {
    ...theme.text.caption,
    color: theme.colors.text.tertiary,
  },
});
```

### 신뢰도 색 선택

```ts
import { colors } from '@/theme';

function confidenceColor(pct: number): string {
  if (pct >= 85) return colors.confidence.high;
  if (pct >= 60) return colors.confidence.medium;
  return colors.confidence.low;
}
```

### 어두운 미디어 표면(카메라/영상)

다크 테마가 아니라 `colors.media.*`로 처리한다.

```ts
backgroundColor: theme.colors.media.cameraBg;       // 카메라 배경
backgroundColor: theme.colors.media.thumbSlate;     // 영상 썸네일
color: theme.colors.text.onMedia;                   // 어두운 표면 위 텍스트
```

## 안티패턴 (금지)

```ts
// ❌ 색상 하드코딩
backgroundColor: '#F4EEDD',
// ✅
backgroundColor: theme.colors.surface.paper,

// ❌ palette 직접 import
import { palette } from '@/theme'; // palette는 export되지 않음 — semantic 경유
// ✅
import { colors } from '@/theme';

// ❌ 간격 매직넘버
padding: 16, marginTop: 12,
// ✅
padding: theme.spacing.lg, marginTop: theme.spacing.md,

// ❌ 폰트 직접 지정
{ fontSize: 24, fontWeight: '700' }
// ✅ 프리셋 경유
{ ...theme.text.cardTitle }
```

신규 색/값이 필요하면 **컴포넌트가 아니라 `tokens.ts`에 추가**한 뒤 semantic 토큰으로 참조한다.

## 폰트 적용 체크리스트

`fontFamily.display`(Gaegu) / `fontFamily.body`(Pretendard)는 로드된 패밀리 이름이다. 실제 적용 전:

1. `assets/fonts/`에 폰트 파일 추가
2. `app/_layout.tsx`에서 `expo-font`의 `useFonts`로 로드, 완료 전 스플래시 유지
3. 폰트 교체는 `typography.ts`의 `fontFamily` 상수만 수정
4. API는 https://docs.expo.dev/versions/v55.0.0/sdk/font/ 확인 (Expo SDK 55)

## 기존 화면 마이그레이션 체크리스트

화면 하나를 토큰으로 옮길 때:

- [ ] `#RRGGBB`·`rgba()` 리터럴을 `colors.*`로 치환 (없는 색은 토큰에 추가)
- [ ] `fontSize`/`fontWeight` 묶음을 `theme.text.*` 프리셋으로 치환
- [ ] `padding`/`margin`/`gap` 숫자를 `spacing.*`로
- [ ] `borderRadius`를 `radius.*`로
- [ ] iOS `shadow*` + Android `elevation` 수기 정의를 `shadow.*`로
- [ ] 어두운 표면은 `colors.media.*` 사용
- [ ] `npx tsc --noEmit` 통과 + 에뮬레이터 시각 확인

권장 순서: Today → Inbox(2모드) → Archive → Settings → record/preview(media).
