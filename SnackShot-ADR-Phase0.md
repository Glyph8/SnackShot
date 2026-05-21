# SnackShot 의사결정 기록 (ADR) — Phase 0 셋업

> 이 문서는 메인 ADR 문서(`SnackShot-ADR.md`)의 후속이다. ADR-018~023은 프로젝트 초기 셋업 단계(Phase 0)에서 내린 결정들이다.

---

## ADR-018: 빌드 방식 — Expo Dev Client 채택

**Status:** accepted **Date:** 2026-05-19

### Situation

ADR-001에서 React Native + Expo를 채택했다. Expo는 두 가지 사용 방식이 있다: Expo Go(공식 클라이언트 앱)와 Dev Client(프로젝트별 커스텀 빌드).

### Task

프로젝트에서 사용할 네이티브 모듈(카메라, SQLite, 영상 압축, 위젯, secure-store)을 모두 지원하는 빌드 방식을 선택해야 한다.

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|Expo Go|빌드 없이 즉시 실행, 학습 용이|Expo SDK가 미리 포함한 모듈만 사용 가능, 커스텀 네이티브 모듈 불가, 위젯 추가 불가|
|**Expo Dev Client**|모든 네이티브 모듈 사용, 위젯/SAF 등 자유로움, 본격 개발에 표준|초기 빌드 15~30분, prebuild로 `android/` 생성 필요|
|Bare RN|완전한 통제|Expo 생태계 이점 상실, 학습 부담↑|

### Action — 최종 선택

**Expo Dev Client** 채택.

이유:

- 본 프로젝트는 `react-native-compressor`(영상 압축), 추후 네이티브 위젯, `expo-secure-store` 등 Expo Go가 커버하지 않는 영역을 다룬다.
- `npx expo prebuild`로 `android/` 디렉토리 생성 → `npx expo run:android`로 빌드.
- `android/` 폴더는 git에 커밋하지 않고 필요 시 재생성(`prebuild --clean`).

### Result — 트레이드오프

- **얻은 것:** 모든 네이티브 모듈 자유 사용, 위젯/SAF 등 미래 기능 자유.
- **잃은 것:** 초기 빌드 시간, prebuild 개념 학습 필요.
- **재검토 조건:** 없음. Dev Client는 사실상 표준.

---

## ADR-019: 라우팅 — expo-router 채택

**Status:** accepted **Date:** 2026-05-19

### Situation

RN의 네비게이션 라이브러리를 선택해야 한다. 사용자는 Next.js(app router)에 익숙하다.

### Task

유지보수성, 학습 곡선, 본인의 기존 경험을 고려한 라우팅 라이브러리를 선택한다.

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|React Navigation (수동)|RN 생태계 표준, 유연|imperative 설정, 코드 분산|
|**expo-router**|file-based routing, Next.js app router와 거의 동일, deep link 자동 처리|Expo 의존, 비교적 신생|
|react-native-navigation (Wix)|네이티브 성능|무거움, 셋업 복잡|

### Action — 최종 선택

**expo-router** 채택.

예시 매핑:

- `app/(tabs)/today.tsx` → `/today` (탭 화면)
- `app/record.tsx` → `/record` (모달)
- `app/entry/[id].tsx` → `/entry/:id` (동적 라우트)
- `snackshot://record` deep link → 위젯에서 진입 시 자동 처리

### Result — 트레이드오프

- **얻은 것:** Next.js 경험 직결, 파일 구조 = 라우트 구조, deep link 자동.
- **잃은 것:** Expo 의존(이미 채택), 일부 고급 패턴은 React Navigation 직접 사용 필요.
- **재검토 조건:** Expo 의존을 끊을 경우(가능성 낮음).

---

## ADR-020: 상태관리 — Zustand 채택

**Status:** accepted **Date:** 2026-05-19

### Situation

앱 전역 상태(설정, 현재 녹화 세션, 미디어 처리 진행률 등)를 관리할 라이브러리를 선택해야 한다.

### Task

본인 사용 도구 규모에 적합하고 React 경험과 자연스러운 상태관리를 선택한다.

### Action — 검토한 대안

|옵션|코드량|학습 곡선|본 프로젝트 적합도|
|---|---|---|---|
|React Context + useReducer|적음|낮음|작은 앱에 OK, 큰 트리에서 성능 이슈|
|**Zustand**|**매우 적음**|**매우 낮음**|**본인 사용 도구에 이상적**|
|Redux Toolkit|많음|중|과한 보일러플레이트|
|Recoil|중|중|atom 모델, 잘 맞지만 zustand보다 무거움|
|Jotai|적음|낮음|좋은 후보, zustand와 거의 동률|

### Action — 최종 선택

**Zustand** 채택. store 분리는 도메인 단위 — `settings`, `ui`(모달 상태 등) 등.

```typescript
// src/stores/settings.ts 예시
import { create } from 'zustand';

interface SettingsStore {
  dayBoundaryHour: number;
  setDayBoundaryHour: (h: number) => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  dayBoundaryHour: 0,
  setDayBoundaryHour: (h) => set({ dayBoundaryHour: h }),
}));
```

### Result — 트레이드오프

- **얻은 것:** 적은 코드, 빠른 학습, hook 기반.
- **잃은 것:** Redux 생태계의 devtools/미들웨어(zustand에도 있지만 더 작음).
- **재검토 조건:** 앱이 복잡해져서 비동기 액션 추적, undo/redo, time-travel이 필수가 되면 Redux Toolkit 재검토.

---

## ADR-021: AI 응답 검증 — Zod 스키마 도입

**Status:** accepted **Date:** 2026-05-19

### Situation

ADR-006~008에서 AI가 결정 후보를 JSON으로 반환하기로 했다. AI 응답은 환각 또는 스키마 불일치 가능성이 있다.

### Task

AI 응답이 기대한 구조와 다를 때 앱이 죽거나 잘못된 데이터가 DB에 들어가는 것을 막아야 한다.

### Action — 검토한 대안

|옵션|안전성|코드 부담|
|---|---|---|
|타입 단언 (`as DecisionCandidate`)|없음, 런타임에 무방비|적음|
|수동 검증 (if-else)|중간, 누락 위험|많음, 유지보수 어려움|
|**Zod 스키마**|**높음, 자동 타입 추론**|**적음**|
|TypeBox / io-ts|비슷|Zod보다 덜 친숙|

### Action — 최종 선택

**Zod** 채택. AI 응답뿐 아니라 DB row 검증, 외부 API 응답 검증에도 활용.

```typescript
// src/services/label/schema.ts 예시
import { z } from 'zod';

export const DecisionCandidateSchema = z.object({
  hasDecision: z.boolean(),
  decisions: z.array(z.object({
    summary: z.string().min(1),
    category: z.enum(['investment', 'relationship', 'career', 'daily', 'other']),
    reasoning: z.string().optional(),
    evidence: z.string(),
    confidence: z.number().min(0).max(1),
    followUpAt: z.string().datetime().nullable(),
  })),
});

// AI 응답 처리
const parsed = DecisionCandidateSchema.safeParse(rawResponse);
if (!parsed.success) {
  // 스키마 불일치 → 로그 + AI 재호출 또는 fallback
  return [];
}
return parsed.data.decisions;
```

### Result — 트레이드오프

- **얻은 것:** 환각 1차 차단, 타입 안전성, 런타임 검증 + 컴파일타임 타입 동시 확보.
- **잃은 것:** Zod 학습 비용(낮음), 번들 크기 약간 증가(무시 가능).
- **재검토 조건:** 없음. AI 응답 처리에 사실상 표준.

---

## ADR-022: 영상 압축 — react-native-compressor 채택

**Status:** accepted **Date:** 2026-05-19

### Situation

ADR-004에서 영상을 720p로 압축해 다이어리 본문에 사용하기로 했다. 압축 라이브러리를 선택해야 한다.

### Task

압축 품질, 속도, 라이브러리 무게, 유지보수성을 균형 있게 만족해야 한다.

### Action — 검토한 대안

|옵션|무게|성능|호환성|
|---|---|---|---|
|**react-native-compressor**|**가벼움**|**빠름 (Android MediaCodec 직접 호출)**|dev client 필요|
|ffmpeg-kit-react-native|무거움 (~80MB)|매우 강력|dev client 필요, 패키지 미래 불확실|
|자체 네이티브 모듈|가변|최적화 가능|유지보수 부담|

### Action — 최종 선택

**react-native-compressor** 채택.

이유:

- Android는 MediaCodec, iOS는 AVAssetWriter 등 OS 네이티브 코덱 직접 사용 → 성능 좋고 가벼움.
- 720p로 압축 + 비트레이트 ~3Mbps 설정 시 1분당 약 25MB.
- `Video.compress()` API가 단순.

ffmpeg-kit은 본 프로젝트의 단순한 압축 요구에는 과하다. 자체 코덱 선택, 워터마크, 자막 합성 등이 필요해지면 그때 재검토.

### Result — 트레이드오프

- **얻은 것:** APK 크기 부담↓, 빠른 압축, 단순한 API.
- **잃은 것:** ffmpeg 수준의 세밀한 코덱 제어 불가.
- **재검토 조건:**
    - 압축 결과 품질이 부족하면 비트레이트/해상도 튜닝 → 그래도 부족하면 ffmpeg-kit.
    - 향후 자막 합성 / 영상 결합 같은 기능 추가 시 ffmpeg-kit 재검토.

---

## ADR-023: API 키 저장 — 이중 fallback (.env → SecureStore)

**Status:** accepted **Date:** 2026-05-19

### Situation

ADR-015에서 production 환경의 API 키는 `expo-secure-store`에 저장하기로 했다. 그러나 개발 중에는 매번 키를 앱에 입력하는 것이 번거롭다.

### Task

개발 편의성과 production 보안을 동시에 만족하는 키 관리 패턴을 정한다.

### Action — 검토한 대안

|옵션|개발 편의|보안|
|---|---|---|
|`.env`만 사용 (`EXPO_PUBLIC_*`)|매우 좋음|번들에 노출됨, 위험|
|SecureStore만 사용|매번 입력 부담|안전|
|**`.env` fallback + SecureStore 우선**|**좋음**|**production에선 SecureStore만**|

### Action — 최종 선택

**우선순위: SecureStore > .env**.

```typescript
// src/lib/env.ts
export async function getOpenAIKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync('snackshot.openai_api_key');
  if (stored) return stored;
  return process.env.EXPO_PUBLIC_DEV_OPENAI_API_KEY ?? null;
}
```

`EXPO_PUBLIC_` 접두사 환경변수는 번들에 포함되어 APK 분해 시 노출 가능. 본인 사용 도구라 위험도는 낮지만, **production 빌드 전 반드시 `.env`에서 키 제거 + SecureStore만 사용** 필수.

`.env`는 `.gitignore`에 포함.

### Result — 트레이드오프

- **얻은 것:** 개발 중 매번 키 입력 불필요, production 안전.
- **잃은 것:** 두 경로 관리, 본인이 의식하지 않으면 production에 키가 새어들어갈 위험.
- **재검토 조건:**
    - 외부 배포 / 공유 시점에 반드시 `.env` 제거하고 SecureStore-only로 전환.
    - 키 회전(rotation) 필요 시 별도 정책 추가.

---

## 변경 이력

|날짜|변경|비고|
|---|---|---|
|2026-05-19|ADR-018 ~ ADR-023 추가|Phase 0 셋업 결정들|

---

## Phase 0 셋업 요약

이 시점까지 결정된 기술 스택:

- **언어**: TypeScript
- **프레임워크**: React Native + Expo (Dev Client)
- **라우팅**: expo-router
- **상태관리**: Zustand
- **검증**: Zod
- **DB**: SQLite (expo-sqlite)
- **영상 압축**: react-native-compressor
- **STT (1차)**: OpenAI Whisper API
- **AI 라벨링 (1차)**: Gemini 2.5 Flash-Lite
- **시크릿 저장**: expo-secure-store (+ 개발용 .env fallback)
- **ID**: ULID
- **시간 처리**: date-fns + UTC Unix ms
- **IDE**: VS Code (메인) + Android Studio (보조)

다음 Phase (Phase 1 — 코어 녹화 루프)에서 결정될 사항들:

- 권한 거부 시 사용자 흐름
- 카운트다운 UI 디자인
- 압축 실패 시 fallback 정책
- 백그라운드 작업 진행률 표시 방식