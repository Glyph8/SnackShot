# SnackShot 의사결정 기록 (ADR)

> Architecture Decision Records — 프로젝트 진행 중 내린 주요 의사결정과 그 근거를 기록한 문서. 추후 회고, 재검토, 면접/포트폴리오 설명용으로 활용.

---

## 문서 사용법

각 결정은 STAR 기법을 따른다:

- **S(Situation)** — 결정이 필요했던 맥락
- **T(Task)** — 해결해야 했던 구체적 문제
- **A(Action)** — 검토한 대안들과 최종 선택
- **R(Result)** — 선택의 결과와 트레이드오프, 추후 재검토 조건

각 결정은 **상태(Status)** 를 가진다: `proposed` / `accepted` / `superseded` / `deprecated`.

---

## 목차

1. [ADR-001: 기술 스택 — React Native (Expo) 선택](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-001-%EA%B8%B0%EC%88%A0-%EC%8A%A4%ED%83%9D--react-native-expo-%EC%84%A0%ED%83%9D)
2. [ADR-002: STT 엔진 — Whisper API + 추상화 레이어](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-002-stt-%EC%97%94%EC%A7%84--whisper-api--%EC%B6%94%EC%83%81%ED%99%94-%EB%A0%88%EC%9D%B4%EC%96%B4)
3. [ADR-003: 클립 단위를 1급 객체로](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-003-%ED%81%B4%EB%A6%BD-%EB%8B%A8%EC%9C%84%EB%A5%BC-1%EA%B8%89-%EA%B0%9D%EC%B2%B4%EB%A1%9C)
4. [ADR-004: 영상 저장 정책 — 압축본 + 원본 분리](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-004-%EC%98%81%EC%83%81-%EC%A0%80%EC%9E%A5-%EC%A0%95%EC%B1%85--%EC%95%95%EC%B6%95%EB%B3%B8--%EC%9B%90%EB%B3%B8-%EB%B6%84%EB%A6%AC)
5. [ADR-005: 녹화 길이 3분 제한](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-005-%EB%85%B9%ED%99%94-%EA%B8%B8%EC%9D%B4-3%EB%B6%84-%EC%A0%9C%ED%95%9C)
6. [ADR-006: 결정 판별 — 단일 녹화 + AI 추출 + Inbox 컨펌](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-006-%EA%B2%B0%EC%A0%95-%ED%8C%90%EB%B3%84--%EB%8B%A8%EC%9D%BC-%EB%85%B9%ED%99%94--ai-%EC%B6%94%EC%B6%9C--inbox-%EC%BB%A8%ED%8E%8C)
7. [ADR-007: AI 호출 단위 — 클립별 즉시 호출](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-007-ai-%ED%98%B8%EC%B6%9C-%EB%8B%A8%EC%9C%84--%ED%81%B4%EB%A6%BD%EB%B3%84-%EC%A6%89%EC%8B%9C-%ED%98%B8%EC%B6%9C)
8. [ADR-008: AI 모델 선택 — Gemini Flash-Lite](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-008-ai-%EB%AA%A8%EB%8D%B8-%EC%84%A0%ED%83%9D--gemini-flash-lite)
9. [ADR-009: ID 체계 — ULID](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-009-id-%EC%B2%B4%EA%B3%84--ulid)
10. [ADR-010: Transcript를 별도 테이블로 분리](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-010-transcript%EB%A5%BC-%EB%B3%84%EB%8F%84-%ED%85%8C%EC%9D%B4%EB%B8%94%EB%A1%9C-%EB%B6%84%EB%A6%AC)
11. [ADR-011: 메타데이터는 JSON 컬럼으로](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-011-%EB%A9%94%ED%83%80%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%8A%94-json-%EC%BB%AC%EB%9F%BC%EC%9C%BC%EB%A1%9C)
12. [ADR-012: 백그라운드 작업 큐 — DB 기반](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-012-%EB%B0%B1%EA%B7%B8%EB%9D%BC%EC%9A%B4%EB%93%9C-%EC%9E%91%EC%97%85-%ED%81%90--db-%EA%B8%B0%EB%B0%98)
13. [ADR-013: 시각 저장 — UTC Unix ms (INTEGER)](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-013-%EC%8B%9C%EA%B0%81-%EC%A0%80%EC%9E%A5--utc-unix-ms-integer)
14. [ADR-014: Soft delete 패턴](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-014-soft-delete-%ED%8C%A8%ED%84%B4)
15. [ADR-015: API 키 저장 — Secure Store 분리](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-015-api-%ED%82%A4-%EC%A0%80%EC%9E%A5--secure-store-%EB%B6%84%EB%A6%AC)
16. [ADR-016: AI 원본과 사용자 편집본 분리 보존](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-016-ai-%EC%9B%90%EB%B3%B8%EA%B3%BC-%EC%82%AC%EC%9A%A9%EC%9E%90-%ED%8E%B8%EC%A7%91%EB%B3%B8-%EB%B6%84%EB%A6%AC-%EB%B3%B4%EC%A1%B4)
17. [ADR-017: 후속 확인 타이밍 — AI 추정 후 사용자 피드백 학습](https://claude.ai/chat/9cc85486-5bc0-40b7-9d1e-9532843e9493#adr-017-%ED%9B%84%EC%86%8D-%ED%99%95%EC%9D%B8-%ED%83%80%EC%9D%B4%EB%B0%8D--ai-%EC%B6%94%EC%A0%95-%ED%9B%84-%EC%82%AC%EC%9A%A9%EC%9E%90-%ED%94%BC%EB%93%9C%EB%B0%B1-%ED%95%99%EC%8A%B5)

---

## ADR-001: 기술 스택 — React Native (Expo) 선택

**Status:** accepted **Date:** 2026-05-19

### Situation

사용자는 React/Next.js로 프론트엔드 개발 경험이 있고 Spring Boot 프로젝트 1건 경험이 있다. Kotlin/Android 네이티브 경험은 없다. 본 프로젝트는 직접 작성보다는 본인 사용 목적의 바이브 코딩으로 진행할 계획이다.

### Task

바이브 코딩 효율성과 본인의 검증 능력을 동시에 만족하는 모바일 스택을 선택해야 한다.

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|**Kotlin + Jetpack Compose**|Android 네이티브 표준, 카메라/위젯 API 직접 접근, 모바일 직고용 시장 가치|학습 곡선 가파름(Kotlin + Compose + Coroutines + Hilt), AI 생성 코드 검증 어려움|
|**React Native (Expo)**|React 자산 재활용, 친숙한 컴포넌트 모델, expo-router가 Next.js app router와 유사|네이티브 모듈 영역에서 학습 필요, 위젯은 결국 네이티브 코드 필요|
|**Flutter**|단일 코드베이스, 성능 우수|Dart 새로 학습, React 자산 활용 불가|

### Action — 최종 선택

**React Native + Expo (with dev client)** 선택.

이유:

- 바이브 코딩의 핵심은 "AI 출력을 본인이 검증·수정할 수 있는가". 익숙한 스택일수록 사이클이 빠르다.
- Expo는 카메라/파일/STT 등 필요한 거의 모든 API를 커버한다.
- iOS 확장 가능성도 자연스럽게 열린다.

### Result — 트레이드오프

- **얻은 것:** 학습 비용 최소화, React 패턴 재활용, AI 코드 검증 능력 유지.
- **잃은 것:** 안드로이드 네이티브 깊이 있는 학습 기회, 일부 네이티브 영역(위젯)은 Kotlin 일부 필요.
- **재검토 조건:** 성능 병목이 RN의 한계에 부딪히거나, 모바일 네이티브 직고용 트랙으로 진로 전환 시 Kotlin + Compose 재검토.

---

## ADR-002: STT 엔진 — Whisper API + 추상화 레이어

**Status:** accepted **Date:** 2026-05-19

### Situation

다이어리의 핵심 기능은 음성 → 텍스트 변환. 한국어 STT 품질이 사용자 경험을 결정한다.

### Task

한국어 정확도, 비용, 프라이버시, 미래 확장성을 모두 고려한 STT 엔진을 선택해야 한다.

### Action — 검토한 대안

|옵션|한국어 품질|비용|프라이버시|비고|
|---|---|---|---|---|
|Android `SpeechRecognizer`|중상|무료|기기 내(일부 모델)|길이 제한 있음, 안정성 편차|
|**OpenAI Whisper API**|상|$0.006/분|클라우드 전송|보편적, 안정적|
|whisper.cpp (on-device)|상(small+)|무료|완전 오프라인|모델 100~500MB, 추론 느림, 메모리 부담|
|Google Cloud Speech-to-Text|상|분당 ~$0.024|클라우드|Whisper보다 비쌈|
|Clova Speech|상|유료|클라우드(한국)|한국 회사|
|Gemini Nano (AICore)|미지|무료|완전 오프라인|Pixel 등 일부 기기만, 보급 진행 중|

### Action — 최종 선택

**Whisper API를 1차 구현체로 채택하되, `SttService` 인터페이스로 추상화**한다.

```typescript
interface SttService {
  transcribe(audioPath: string, options: TranscribeOptions): Promise<TranscriptResult>;
  getEngineInfo(): { name: string; version: string };
}
```

### Result — 트레이드오프

- **얻은 것:** 즉시 사용 가능한 안정적 한국어 STT, 합리적 비용(하루 10분 사용 시 월 약 $2), 미래 엔진 교체 자유.
- **잃은 것:** 인터넷 의존, 클라우드 전송 프라이버시 우려, API 키 관리 부담.
- **재검토 조건:**
    - Gemini Nano가 보편화되면 on-device로 전환 검토 (무료 + 오프라인).
    - 사용량이 폭증하여 월 비용이 부담될 때 whisper.cpp 평가.
    - 프라이버시 요구가 강해지면 on-device 우선.

---

## ADR-003: 클립 단위를 1급 객체로

**Status:** accepted **Date:** 2026-05-19

### Situation

초기 기획에선 "하루 단위 다이어리"가 자연스러운 비유였다. 하지만 확장 기능(AI 라벨링, 판단 보조, 검색)이 의미를 가지려면 분석 단위가 명확해야 한다.

### Task

데이터 모델의 최소 단위를 "Day"로 할지 "Clip"으로 할지 결정해야 한다.

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|**Day 1급, Clip은 종속**|비유가 직관적, 하루 화면 구성 쉬움|클립별 라벨링·검색·분석 어려움, 결정 1개가 클립 1개에 매칭되지 않음|
|**Clip 1급, Day는 뷰**|모든 분석/검색의 단위가 일관, AI 라벨링 정확도↑, 결정 객체와 1:1 매핑 자연스러움|"Day" 개념을 쿼리로 구성해야 함|

### Action — 최종 선택

**Clip을 1급 객체(`entries` 테이블)로 두고, Day 화면은 시간순 그룹화 뷰**로 처리.

```sql
-- Day 화면 쿼리
SELECT * FROM entries
WHERE date(recorded_at, ...) = '2026-05-19'
  AND deleted_at IS NULL
ORDER BY recorded_at ASC;
```

### Result — 트레이드오프

- **얻은 것:** 모든 분석/검색의 단위 일관, 결정 추출이 자연스럽게 클립과 매핑, 미래 확장(태그, 위치, 기분) 자유.
- **잃은 것:** "오늘의 다이어리"라는 추상이 쿼리로 구성됨(약간의 복잡도 증가).
- **재검토 조건:** 클립 단위 분석의 가치가 미미하고 사용자가 항상 Day 단위로만 인지한다면 재검토. 그러나 본 프로젝트는 확장 기능 의존도가 높아 가능성 낮음.

---

## ADR-004: 영상 저장 정책 — 압축본 + 원본 분리

**Status:** accepted **Date:** 2026-05-19

### Situation

1080p 1분 영상 ≈ 100MB. 하루 3개 클립 × 2분이면 일 약 600MB. 사용자 디바이스 용량 부담이 크다.

### Task

영상 품질, 용량, 사용자 접근성을 균형 있게 다루는 저장 정책을 정해야 한다.

### Action — 검토한 대안

|옵션|용량|품질|사용자 통제|
|---|---|---|---|
|원본만 보관|매우 큼|최상|폭주 위험|
|압축본만 보관|작음|중|원본 손실|
|**압축본 + 원본 분리 보관**|중간|최상 가능|사용자가 원본 별도 정리 가능|

### Action — 최종 선택

- **압축본(720p, ~3Mbps)**: 앱 내부, 다이어리 기본 재생에 사용. 1분당 ~25MB.
- **원본**: 사용자 지정 vault 폴더(SAF), 날짜별 디렉토리 구조. 사용자가 직접 정리하거나 외장 옮김 가능.
- **썸네일**: 작은 JPEG, 앱 내부.

```
[vault]/SnackShot/
├── originals/2026/05/19/1430_a3f2.mp4
├── compressed/2026/05/19/1430_a3f2.mp4
└── thumbnails/2026/05/19/1430_a3f2.jpg
```

### Result — 트레이드오프

- **얻은 것:** 일상 사용은 가벼움, 원본 보존, 사용자가 용량 직접 관리.
- **잃은 것:** 압축 작업 시간(녹화 직후 백그라운드), 저장소 두 곳 관리 복잡도.
- **재검토 조건:** 압축본만으로 충분하다고 판단되면 원본 보관을 옵션으로 변경. 또는 N일 후 원본 자동 삭제 옵션 추가.
- **구현 노트 (2026-06-11):** "원본은 사용자 지정 vault 폴더(SAF)" 항목은 구현되지 않았고 **ADR-026으로 대체되었다** — vault에는 압축본+썸네일만 export하고(데일리 노트 임베드용), 원본은 앱 내부 저장소에 보관한다. 위 폴더 구조 예시(`originals/`, `compressed/`)도 실제 구현(ADR-026의 `entries/`+`media/`)과 다르므로 참고만 할 것. 원본의 외부 백업이 필요해지면 별도 export 옵션으로 재검토.

---

## ADR-005: 녹화 길이 3분 제한

**Status:** accepted **Date:** 2026-05-19

### Situation

사용자가 준비 없이 즉흥 녹화할 때 보통 길게 말하지 못한다. 동시에 영상 길이는 용량/STT 비용/처리 시간에 직접 영향을 준다.

### Task

실용성과 비용·UX의 균형 지점을 찾아야 한다.

### Action — 검토한 대안

|길이|영상 용량(압축)|STT 비용|UX|
|---|---|---|---|
|1분|~25MB|$0.006|너무 짧을 수 있음|
|**3분**|**~75MB**|**$0.018**|충분, 부담 적음|
|10분|~250MB|$0.06|길어서 사용 빈도 떨어질 위험|
|무제한|가변|가변|통제 어려움|

### Action — 최종 선택

**3분 상한 + 3초 하한**. 카운트다운 UI 제공.

### Result — 트레이드오프

- **얻은 것:** 비용·UX·처리 시간 균형, 사용자 부담 적음.
- **잃은 것:** 긴 회고를 한 클립에 담는 유연성.
- **재검토 조건:** 사용자가 3분 제한에 빈번하게 부딪치면 5분으로 상향, 또는 "장시간 녹화" 별도 모드 추가.

### Revision (2026-06-20): 일시정지/이어찍기 도입 + 상한 재정의

**Status:** accepted **Date:** 2026-06-20

#### Situation

즉흥 녹화 중 생각을 정리하거나 잠시 멈췄다 이어가고 싶은 수요가 있으나, 한 호흡 녹화만 가능해 멈추면 처음부터 다시 찍어야 한다.

#### Action — 타당성 (SDK 55 확인)

- 오디오: `expo-audio` `AudioRecorder.pause()` / `record()`(재개) 지원.
- 영상: `expo-camera@55.0.18` `CameraView.toggleRecordingAsync()`(일시정지↔재개). iOS는 18+에서만 동작, 가용 여부는 `getSupportedFeatures().toggleRecordingAsyncAvailable`로 확인. ffmpeg 병합 불필요.

#### Action — 최종 선택

1. 일시정지/이어찍기를 **오디오·영상 모두** 도입. 영상은 `toggleRecordingAsyncAvailable`가 true일 때만 일시정지 노출(미지원 시 graceful 숨김 — 녹화·저장은 유지).
2. **"3분 상한 · 3초 하한"을 누적 녹화 시간(일시정지 구간 제외) 기준으로 재정의.** 일시정지 중 타이머·`maxDuration` 카운트 정지. 저장 `durationMs`=누적.

#### Result — 트레이드오프

- **얻은 것:** 오디오·영상 모두 끊고 이어가는 유연성, 상한 정의 명확화(벽시계가 아닌 누적), 추가 네이티브 의존 없음.
- **잃은 것:** iOS 18 미만 영상 일시정지 미제공(기능 게이팅으로 흡수).
- **영향 범위:** `app/record-audio.tsx`·`app/record.tsx`만. DB 스키마·마이그레이션 무변경.
- **재검토 조건:** `maxDuration`의 일시정지 시간 회계가 SDK에서 바뀌면 누적 로직 재점검.

---

## ADR-006: 결정 판별 — 단일 녹화 + AI 추출 + Inbox 컨펌

**Status:** accepted **Date:** 2026-05-19

### Situation

확장 기능 "판단 보조"를 위해서는 클립 중 어느 것이 "의사결정을 포함하는가"를 식별해야 한다. 이 판별을 누가 어느 시점에 하느냐가 데이터 품질과 UX를 모두 결정한다.

### Task

정확도, 사용자 마찰, 데이터 신뢰성을 동시에 만족하는 결정 판별 흐름을 설계해야 한다.

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|사용자가 녹화 시 결정/일기 버튼 분리|명확한 사용자 의도|매 녹화마다 분류 부담, 결정은 뒤늦게 인지되는 경우 많음, 버튼 늘면 마찰|
|AI 자동 추출만|사용자 마찰 0|환각으로 노이즈 누적, 검토 없으면 후속 분석 신뢰성↓|
|**단일 녹화 + AI 추출 + 사용자 Inbox 컨펌**|마찰 최소, 환각 차단, 컨펌 행위가 메타인지 효과|컨펌 단계 자체가 작은 마찰|

### Action — 최종 선택

**3단계 흐름:**

1. **녹화는 단일 버튼.** 사용자는 모드 분류 안 함.
2. **STT 후 AI가 좁은 기준으로 결정 후보 추출** (status='extracted'). 신뢰도와 evidence_quote 포함.
3. **사용자가 Decision Inbox에서 카드 단위로 컨펌/거절/수정** (status='confirmed'/'rejected'/'edited').

부가:

- 녹화 직후 선택적 "중요 결정 포함" 힌트 토글(누르지 않으면 AI에게 맡김).
- 클립 detail에서 "이 클립에 결정 추가" 수동 진입 가능.

### Result — 트레이드오프

- **얻은 것:** 녹화 마찰 0, AI 환각이 데이터에 직접 들어가지 않음, 컨펌된 데이터의 신뢰성↑, 메타인지 효과(본인이 "이게 결정이었나" 돌아보는 순간).
- **잃은 것:** Inbox 컨펌 단계가 누락되면 결정 데이터가 stale해짐. 알림으로 보완 필요.
- **재검토 조건:** Inbox 컨펌률이 낮으면 (a) UI 단순화, (b) 자동 컨펌 임계값(confidence > X) 옵션, (c) 알림 강화 검토.

---

## ADR-007: AI 호출 단위 — 클립별 즉시 호출

**Status:** accepted **Date:** 2026-05-19

### Situation

ADR-006의 AI 추출 단계를 어느 단위로 호출할지 결정해야 한다. 비용은 둘 다 미미하므로 다른 축으로 판단해야 한다.

### Task

정확도, UX 흐름, 복원력을 고려한 호출 단위를 정한다.

### Action — 검토한 대안

|옵션|정확도|UX|복원력|
|---|---|---|---|
|**클립별 즉시 호출**|컨텍스트 작아 환각 적음, 귀속 명확|즉시 Inbox 등장|실패가 클립 단위로 격리|
|하루 모아서 1회 호출|클립 간 섞임 위험, 귀속 모호|하루 끝에야 Inbox 등장|1회 실패 시 그날 전체 영향|

### Action — 최종 선택

**클립별 즉시 호출 (Stage 1)**. 클립 간 연관성은 **별도 Stage 2(`decision_links`)로 분리**하여 confirmed Decision 위에서만 분석.

### Result — 트레이드오프

- **얻은 것:** 추출 정확도, 즉시 UX, 격리된 실패 복원, 귀속 명확.
- **잃은 것:** 클립 간 연관성이 자동 추출되지 않음 → 별도 분석 단계 필요.
- **재검토 조건:** Stage 2 분석으로 충분한 연관성이 잡히지 않으면 통합 호출 재검토.

---

## ADR-008: AI 모델 선택 — Gemini Flash-Lite

**Status:** accepted **Date:** 2026-05-19

### Situation

결정 추출 작업은 정형화된 JSON 출력을 요구한다. 본인 사용 도구로 비용 부담은 최소화하되 한국어 구어체 처리가 가능해야 한다.

### Task

정확도/비용/속도 균형을 만족하는 모델을 선택한다.

### Action — 검토한 대안 (2026-05 기준)

|모델|입력 가격|출력 가격|정확도 추정|
|---|---|---|---|
|Gemini 2.5 Pro|$1.25/M|$10/M|매우 높음, 과함|
|Gemini 2.5 Flash|$0.30/M|$2.50/M|높음|
|**Gemini 2.5 Flash-Lite**|**$0.10/M**|**$0.40/M**|추출 작업에 충분|
|Claude Sonnet 4|$3/M|$15/M|매우 높음, 과함|

### Action — 최종 선택

**Gemini 2.5 Flash-Lite를 기본 엔진으로 채택**. `LabelService` 인터페이스로 추상화하여 모델 교체 자유 확보.

```typescript
interface LabelService {
  extractDecisions(transcript: string, hints: Hints): Promise<DecisionCandidate[]>;
  getEngineInfo(): { name: string; version: string };
}
```

비용 추산 (하루 3클립 × 2분 기준):

- 월 약 30원, 연 약 300원.
- 무료 티어로도 충분(15 RPM, 1,000 RPD).

### Result — 트레이드오프

- **얻은 것:** 사실상 무료 운영, 인터페이스 추상화로 교체 자유.
- **잃은 것:** Pro 모델 대비 일부 복잡한 결정 추출 정확도 손실 가능.
- **재검토 조건:**
    - 추출 정확도가 부족하면 Flash 또는 Pro로 승급.
    - Gemini Nano on-device 보급 시 전환 검토.
    - 무료 티어 한도 초과 시 유료 전환.

---

## ADR-009: ID 체계 — ULID

**Status:** accepted **Date:** 2026-05-19

### Situation

DB의 PK 형식을 정해야 한다. 클라이언트(앱)에서 ID를 생성해야 하므로 서버 시퀀스는 불가.

### Task

정렬 가능성, 충돌 안전성, 가독성을 고려한 ID 체계를 선택한다.

### Action — 검토한 대안

|옵션|시간순 정렬|충돌 안전성|가독성|
|---|---|---|---|
|Auto-increment INTEGER|O|클라이언트 생성 시 위험|좋음|
|UUID v4|X|매우 안전|길고 무작위|
|**ULID**|**O (lexicographic)**|**매우 안전**|UUID보다 짧고 정렬됨|
|UUID v7|O|안전|UUID와 유사|

### Action — 최종 선택

**ULID** 채택. `01HKQM3...` 형식. 시간 prefix + 랜덤 suffix.

### Result — 트레이드오프

- **얻은 것:** B-tree 인덱스 효율(시간순 삽입), 클라이언트 생성 안전, 디버깅 시 시각 추정 가능.
- **잃은 것:** UUID v4 대비 약간의 시간 정보 노출(보안상 큰 문제 없음, 본인 사용 도구).
- **재검토 조건:** 미래 표준이 UUID v7로 자리잡으면 v7로 전환 검토(거의 동일한 특성).

---

## ADR-010: Transcript를 별도 테이블로 분리

**Status:** accepted **Date:** 2026-05-19

### Situation

STT 결과를 `entries.transcript` 컬럼에 둘지, 별도 `transcripts` 테이블로 분리할지 결정.

### Task

단순함과 확장성 사이 균형을 잡는다.

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|`entries`에 컬럼으로|단순, 쿼리 한 번에 가져옴|STT 재생성/다국어/엔진 추적 어려움|
|**별도 `transcripts` 테이블**|STT 이력 보존, 다국어 가능, 엔진 교체 시 재생성 자유|JOIN 한 번 추가|

### Action — 최종 선택

**별도 테이블 분리.** 1:N 관계(Entry 1개에 transcript 여러 버전 가능).

### Result — 트레이드오프

- **얻은 것:** STT 엔진 교체 시 기존 데이터 보존 + 새 버전 추가 가능, 다국어 확장 자유, FTS5 인덱스를 transcripts에만 부착 가능.
- **잃은 것:** 쿼리 시 JOIN 한 번 추가, 대부분의 Entry가 transcript 1개라 약간 과한 모델.
- **재검토 조건:** 한국어만 평생 쓰고 STT 재생성도 안 한다면 합치는 것 고려. 그러나 가능성 낮음.

---

## ADR-011: 메타데이터는 JSON 컬럼으로

**Status:** accepted **Date:** 2026-05-19

### Situation

미래에 추가될 수 있는 메타데이터(위치, 날씨, 태그, 기분 등)를 어떻게 모델링할지 결정.

### Task

스키마 변경 비용을 최소화하면서 미래 확장을 수용한다.

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|필드별 컬럼 추가|쿼리 효율, 타입 안전|마이그레이션 매번 필요, 사용 안 하는 컬럼 누적|
|**`metadata_json` 단일 컬럼**|스키마 변경 없이 확장, 미정형 데이터 수용|쿼리 효율↓, 타입 안전성↓|
|별도 `entry_metadata` 테이블 (key-value)|유연성 최상|쿼리 복잡, 단순 메타에 과함|

### Action — 최종 선택

**`metadata_json` 컬럼(JSON string)** 채택. 사용 패턴이 정착되면 자주 쿼리되는 필드는 정식 컬럼으로 승격.

### Result — 트레이드오프

- **얻은 것:** 스키마 안정성, 빠른 시도, 마이그레이션 부담↓.
- **잃은 것:** JSON 내 필드 검색 시 인덱스 활용 어려움(SQLite의 `json_extract`는 가능하나 효율 떨어짐).
- **재검토 조건:** 특정 필드(예: 태그)가 자주 검색되면 정식 컬럼/테이블로 분리.

---

## ADR-012: 백그라운드 작업 큐 — DB 기반

**Status:** accepted **Date:** 2026-05-19

### Situation

영상 압축, STT, AI 라벨링은 모두 비동기 백그라운드 작업이다. 작업 큐의 구현 방식을 정해야 한다.

### Task

앱 종료/크래시에도 작업이 안전하게 보존되고 재개되어야 한다.

### Action — 검토한 대안

|옵션|영속성|동시성 처리|구현 복잡도|
|---|---|---|---|
|메모리 큐|없음 (앱 종료 시 소실)|단순|매우 낮음|
|파일 기반 큐|있음|race condition 위험|중|
|**DB 기반 큐 (`ai_jobs`)**|**있음**|**트랜잭션으로 자연 해결**|낮음|

### Action — 최종 선택

**SQLite `ai_jobs` 테이블 기반 큐.** 각 작업이 row, 상태 컬럼으로 진행 추적.

```sql
CREATE TABLE ai_jobs (
  id, job_type, target_id, status, attempts, last_error,
  scheduled_at, started_at, completed_at, payload_json
);
```

### Result — 트레이드오프

- **얻은 것:** 앱 크래시/재시작 후 작업 자동 재개, 재시도 추적, 상태 모니터링 UI 쉬움, 디버깅 용이.
- **잃은 것:** 메모리 큐 대비 약간의 오버헤드(무시 가능).
- **재검토 조건:** 작업 수가 폭증해 SQLite 큐가 병목이면 별도 큐 시스템 도입. 본 프로젝트 규모로는 불필요.
- **구현 노트 (2026-06-11):** 현재 워커(`src/services/jobs/queue.ts`)는 앱 foreground에서 5초 폴링하는 방식이다. OS 레벨 백그라운드 실행이 아니며 **앱이 떠 있는 동안만 잡이 소비된다** — 여기서 "백그라운드"는 UI 스레드를 막지 않는다는 의미. 잡은 DB에 영속되므로 앱 재실행 시 이어서 처리된다. OS 백그라운드 처리가 필요해지면 expo-task-manager 재검토.

---

## ADR-013: 시각 저장 — UTC Unix ms (INTEGER)

**Status:** accepted **Date:** 2026-05-19

### Situation

모든 timestamp 컬럼의 저장 형식을 정해야 한다.

### Task

타임존 안전성, 인덱스 효율, JS 친화성을 모두 만족해야 한다.

### Action — 검토한 대안

|옵션|인덱스 효율|타임존 안전|JS 친화성|
|---|---|---|---|
|ISO8601 TEXT (`'2026-05-19T05:30:00Z'`)|보통(문자열 비교)|명시적|Date 파싱 필요|
|**Unix epoch ms INTEGER**|**최상**|**UTC 고정**|**`new Date(ms)`로 즉시**|
|Unix epoch s INTEGER|최상|UTC 고정|ms 변환 필요|

### Action — 최종 선택

**Unix epoch ms (INTEGER)** 모든 timestamp에 적용. UTC 기준. UI에서만 사용자 타임존으로 변환.

### Result — 트레이드오프

- **얻은 것:** 인덱스 최고 효율, JS Date와 1:1, 타임존 사고 방지(여행/DST).
- **잃은 것:** DB를 직접 들여다볼 때 사람이 읽기 어려움 (SQL 쿼리에서 `datetime(ms/1000, 'unixepoch')` 변환 필요).
- **재검토 조건:** 없음. 사실상 표준 패턴.

---

## ADR-014: Soft delete 패턴

**Status:** accepted **Date:** 2026-05-19

### Situation

사용자가 클립/결정을 삭제할 때 즉시 물리 삭제할지, 마킹만 하고 나중에 정리할지 결정.

### Task

실수 복구 가능성과 저장소 효율을 균형 있게 다룬다.

### Action — 검토한 대안

|옵션|복구 가능성|저장소 부담|
|---|---|---|
|Hard delete|없음|즉시 회수|
|**Soft delete (`deleted_at`)**|**30일 내 복구 가능**|임시 부담, 백그라운드 정리|

### Action — 최종 선택

**Soft delete.** DB row는 `deleted_at` 마킹, 실제 영상 파일은 30일 후 백그라운드 정리.

모든 쿼리에 `WHERE deleted_at IS NULL` 기본 적용 (또는 view 활용).

### Result — 트레이드오프

- **얻은 것:** 실수 복구, 데이터 손실 위험↓.
- **잃은 것:** 모든 쿼리에 필터 추가 필요, 임시 저장소 부담.
- **재검토 조건:** 사용자가 복구 기능을 거의 안 쓰면 보존 기간 단축.
- **구현 노트 (2026-06-11):** 현재 구현(아카이브 삭제 UI)은 "파일도 삭제" 옵션을 제공한다. 선택 시 영상/썸네일 파일은 **즉시 hard delete**되고 DB row만 soft delete로 남는다 — 이 경우 복구해도 메타데이터(트랜스크립트, 결정 등)만 복원되며 미디어는 돌아오지 않는다. 저장 공간 회수를 우선한 의도적 선택. 30일 백그라운드 정리는 미구현(미결정 사항).

---

## ADR-015: API 키 저장 — Secure Store 분리

**Status:** accepted **Date:** 2026-05-19

### Situation

Whisper API, Gemini API 등 외부 API 키를 어디에 저장할지 결정.

### Task

보안과 접근성을 동시에 만족해야 한다.

### Action — 검토한 대안

|옵션|보안|편의성|
|---|---|---|
|SQLite 평문|매우 위험|단순|
|AsyncStorage|위험(평문)|단순|
|**expo-secure-store (Android Keystore)**|**암호화**|별도 API|

### Action — 최종 선택

**`expo-secure-store` 사용.** Android Keystore 위에서 OS 수준 암호화.

### Result — 트레이드오프

- **얻은 것:** 키 유출 위험 최소화.
- **잃은 것:** Secure Store API를 따로 호출해야 함(약간의 코드 분기).
- **재검토 조건:** 없음. 보안 표준.

---

## ADR-016: AI 원본과 사용자 편집본 분리 보존

**Status:** accepted **Date:** 2026-05-19

### Situation

AI가 추출한 결정 요약/카테고리 등을 사용자가 편집할 수 있다. 원본을 덮어쓸지 보존할지 결정.

### Task

편집 후에도 원본을 추적 가능해야 한다(AI 품질 개선, 재학습, 디버깅).

### Action — 검토한 대안

|옵션|장점|단점|
|---|---|---|
|덮어쓰기|단순|AI 원본 손실|
|**분리 보존 (`summary` + `user_summary`)**|원본 보존, 추적 가능|컬럼 2배|
|별도 history 테이블|모든 편집 이력|과함|

### Action — 최종 선택

**AI 원본(`summary`, `category`, `reasoning`)과 사용자 편집본(`user_summary`, ...)을 별도 컬럼으로 분리 보존.**

조회 시 `COALESCE(user_summary, summary)` 패턴으로 편집본 우선 표시.

### Result — 트레이드오프

- **얻은 것:** AI 품질 추적 가능, 사용자 편집 패턴 분석 가능(미래 개인화), 환각 검증 시 원본 비교.
- **잃은 것:** 컬럼 수 증가, 약간의 저장소 부담(무시 가능).
- **재검토 조건:** 사용자가 거의 편집 안 하면 history 테이블로 옮기는 것 검토.

---

## ADR-017: 후속 확인 타이밍 — AI 추정 후 사용자 피드백 학습

**Status:** accepted **Date:** 2026-05-19

### Situation

결정의 결과를 언제 사용자에게 물어볼지 결정. 너무 빠르면 결과가 안 났고, 너무 늦으면 기억 안 남.

### Task

초기에는 합리적 기본값을 제공하고, 사용량이 누적되면 개인화해야 한다.

### Action — 검토한 대안

|옵션|초기 정확도|개인화|
|---|---|---|
|카테고리별 고정값|보통|없음|
|**AI가 결정 내용 보고 추정 → 사용자 수정 가능 → 피드백 누적 학습**|보통 → 점점 향상|점진적|
|사용자가 매번 설정|사용자 의도 정확|마찰↑|

### Action — 최종 선택

**AI 추정 + 사용자 수정 + 피드백 누적**:

1. 결정 추출 시 AI가 `follow_up_at` 추정 (예: 주식 → 1주, 일상 → 2일).
2. Inbox 컨펌 시 사용자가 수정 가능 (`follow_up_set_by` = 'user').
3. 후속 알림 시 "너무 빨랐다/늦었다/기억 안 남" 피드백 수집.
4. 누적 데이터로 추후 AI 추정 개인화 (향후 ML/통계 작업).

### Result — 트레이드오프

- **얻은 것:** 즉시 사용 가능한 기본값, 개인화 경로 확보.
- **잃은 것:** 초기 정확도는 일반적 휴리스틱 수준.
- **재검토 조건:** 피드백 데이터가 충분히 누적되면 (3개월~) 개인화 알고리즘 본격 구현.

---

## ADR-024: SQLite Foreign Key 강제 비활성 유지

**Status:** accepted **Date:** 2026-06-11

### Situation

스키마의 `REFERENCES` 절은 SQLite에서 `PRAGMA foreign_keys = ON`을 연결마다 설정해야 강제된다. 현재 어디에서도 설정하지 않아 FK는 문서화 역할만 한다. 이를 명시적 결정 없이 방치하면 "강제되는 줄 알았던" 버그의 원인이 된다.

### Task

FK 강제를 켤지, 끈 상태를 공식 결정으로 만들지 정한다.

### Action — 검토한 대안

|옵션|무결성|마이그레이션 영향|
|---|---|---|
|`PRAGMA foreign_keys = ON`|DB가 강제|테이블 재생성 마이그레이션(v3 방식)과 충돌 — DROP TABLE 시 FK 위반. 마이그레이션 중 OFF 토글 필요|
|**OFF 유지 (현행)**|앱 레이어 책임|마이그레이션 단순 유지|

### Action — 최종 선택

**OFF 유지.** 본인 사용 도구로 쓰기 경로가 모두 repo 함수를 거치므로 참조 무결성은 앱 레이어에서 충분히 보장된다. `REFERENCES` 절은 스키마 문서화 용도로 유지한다.

### Result — 트레이드오프

- **얻은 것:** 테이블 재생성 마이그레이션 단순함, soft delete와 FK 제약 간 충돌 고민 불필요.
- **잃은 것:** 고아 row를 DB가 막아주지 않음 — repo 함수 밖에서 직접 쿼리하면 무결성 위반 가능.
- **재검토 조건:** 다중 기기 동기화/외부 도구가 DB에 직접 쓰기 시작하면 ON 전환 + 마이그레이션 중 OFF 토글 패턴 도입.

---

## ADR-025: android/ 폴더 보존 정책 — Expo Config Plugin

**Status:** accepted **Date:** 2026-06-11

### Situation

SnackShot에 Android 홈 화면 위젯을 추가했다. 위젯은 Kotlin 소스(`SnackShotWidget.kt`), 레이아웃 XML, 위젯 메타 XML, 색상 리소스 등 순수 네이티브 파일로 구성된다. 이 파일들은 `android/` 폴더 안에 있으나, `expo prebuild --clean` 실행 시 `android/` 전체가 삭제·재생성된다.

### Task

위젯 파일이 prebuild 이후에도 자동으로 복원되도록 보호 전략을 결정한다.

### Action — 검토한 대안

| 옵션 | 보호 방법 | 트레이드오프 |
|------|-----------|-------------|
| **android/ git 커밋** | 파일 자체를 버전 관리 | 단순하지만 `prebuild --clean` 후 재적용 필요. 파일 충돌 가능성. |
| **Expo Config Plugin** | prebuild 시 자동 주입 | 학습 비용 있으나 `prebuild --clean`에 완전 안전. `android/`를 gitignore 가능. |
| **patch-package** | npm 패키지 패치로 처리 | 위젯처럼 앱 자체 파일에는 맞지 않는 패턴. |

### Action — 최종 선택

**Expo Config Plugin** (`plugins/with-snackshot-widget.ts`).

구조:
```
plugins/
  with-snackshot-widget.ts   ← TypeScript 소스 (authoring)
  with-snackshot-widget.js   ← tsc 컴파일 산출물 (Expo가 require)
  tsconfig.json              ← 플러그인 전용 컴파일 설정 (Node CommonJS)
  widget/
    java/SnackShotWidget.kt
    res/drawable/widget_*.xml
    res/layout/snackshot_widget.xml
    res/xml/snackshot_widget_info.xml
```

플러그인이 하는 일 (prebuild 시 자동 실행):
1. `plugins/widget/` → `android/app/src/main/res|java/` 파일 복사
2. `values/colors.xml`, `values-night/colors.xml`에 위젯 색상 추가 (멱등)
3. `AndroidManifest.xml`에 `<receiver android:name=".SnackShotWidget">` 삽입 (중복 방지)

컴파일 방법: `npm run build:plugin` (= `tsc -p plugins/tsconfig.json`)

### Result — 트레이드오프

- **얻은 것:** `expo prebuild --clean` 이후 위젯 자동 복원. `android/`를 gitignore에 추가 가능. 위젯 소스가 `plugins/widget/`에 응집.
- **잃은 것:** `.ts` → `.js` 컴파일 단계 필요. 위젯 파일 변경 시 `npm run build:plugin` 실행 + `android/`에 반영 필요.
- **운영 규칙:** 위젯 파일 수정 → `plugins/widget/` 수정 → `npm run build:plugin` → `expo prebuild` (또는 `expo run:android`로 자동 적용).
- **재검토 조건:** iOS 위젯(WidgetKit) 추가 시 동일 패턴 확장.

---

## ADR-026: 옵시디언 연동 — SAF 폴더 export + Syncthing 전송

**Status:** accepted **Date:** 2026-06-11

### Situation

사용자는 옵시디언을 데스크탑에서만 사용하며, 백업은 공식 Sync가 아닌 git 플러그인(obsidian-git)으로 한다. SnackShot으로 기록한 일기를 썸네일·압축 영상·텍스트 형태로 옵시디언에서 관리하고 싶다. ADR-004가 이미 `[vault]/SnackShot/` 폴더 구조를 예고했고, 미결정 사항 4번("옵시디언 export 포맷")이 이 결정을 기다리고 있었다.

### Task

(1) 폰 → 데스크탑 vault 전송 경로, (2) vault 내 노트/미디어 포맷, (3) git 백업과의 공존 정책을 정한다.

### Action — 검토한 대안 (전송 경로)

|옵션|평가|
|---|---|
|**앱 → SAF 폴더 export + Syncthing 동기화**|**채택.** 앱은 로컬 폴더 쓰기만 책임. 무료·로컬·OS 무관|
|옵시디언 모바일 + obsidian-git|기각. 모바일 git은 isomorphic-git 기반 — SSH 미지원, 메모리 제한, 대형 vault 스캔 수 분. 플러그인 공식 문서도 모바일 사용 비권장|
|앱이 직접 git push|기각. RN에 git 구현 부담 + 영상 바이너리는 git에 부적합|
|클라우드 드라이브 경유 + 데스크탑 가져오기 스크립트|기각. 외부 의존 + 스크립트 유지보수 추가|

전송 도구: Syncthing 공식 안드로이드 앱은 2024-12 단종 → 커뮤니티 포크 **Syncthing-Fork**(F-Droid) 사용. 2026-02 기준 활발히 유지됨.

### Action — 최종 선택

1. **앱의 책임 경계:** vault 미러 폴더(SAF)에 export까지만. 전송은 Syncthing-Fork(폰) ↔ Syncthing(데스크탑).
2. **노트 단위 (2026-06-11 변경):** ~~클립당 마크다운 1개~~ → **하루당 마크다운 1개** (사용자 결정 — 일기는 하루 단위가 자연스러움). 클립은 `## HH:mm — 모드 (길이)` 섹션으로 시간순으로 이어 붙는다. export는 섹션 append가 아니라 **그 날 전체를 재생성하는 멱등 방식** — 트랜스크립트 수정·재실행에도 중복 섹션이 생기지 않는다. 멱등성 키는 파일명(논리적 날짜, dayBoundaryHour 적용) + 섹션 내 `%% snackshot_id %%` 주석.
3. **폴더 구조 (2026-06-12 파일명 개정):**
   ```
   [vault]/SnackShot/
   ├── entries/YYYY/MM/YYYY-MM-DD-snackshot.md  ← 데일리 노트 (하루 1개)
   └── media/YYYY/MM/<ulid>.mp4 (압축본), <ulid>.jpg (썸네일), <ulid>.m4a (음성)
   ```
4. **git 공존 정책:** 압축 영상(분당 ~25MB)은 vault `.gitignore`로 **git 제외** — git은 바이너리 diff 불가라 repo가 수개월 내 수십 GB로 폭주한다. 영상 백업은 Syncthing 복제(폰+데스크탑 2벌) + 앱 내 보관으로 충분. 썸네일(수십 KB)과 마크다운은 git 포함.
5. **방향:** 단방향(앱 → vault). 노트에 "SnackShot 관리 파일" 명시. 옵시디언 편집의 역반영(양방향)은 충돌 해소 설계가 필요하므로 보류.
6. **구현 방식:** `ai_jobs`에 `obsidian_export` 잡 타입 추가(ADR-012 큐 재사용), `entries.exported_at`으로 증분 추적. STT 완료 시 자동 큐잉 + 설정에서 수동 전체 재export. 압축 미완료 시 RescheduleError 재예약. SAF 접근은 expo-file-system 신 API(`pickDirectoryAsync`, SAF URI 쓰기/복사 — SDK 55 지원 확인됨, 구현 시 실기기 검증 필수).
7. **기존 일기와의 통합 (2026-06-12 추가):** 데일리 노트 파일명에 `-snackshot` suffix를 붙인다 — 사용자의 기존 일기(`일기/YYYY-MM-DD.md`)와 베이스명이 겹치면 옵시디언 위키링크(vault 전역 이름 해석)가 모호해져 일기의 `[[어제]]` 내비게이션이 SnackShot 노트로 오작동한다. 통합은 **사용자 일기 템플릿의 임베드 한 줄**(`![[YYYY-MM-DD-snackshot]]`)로 한다. SnackShot이 사용자 일기 파일에 직접 쓰는 방식은 기각: (a) Syncthing 동시 수정 충돌(저녁 데스크탑 일기 작성 vs 폰 export), (b) 일기의 월별 `과거/` 아카이빙 이동 후 늦은 재export(7~30일 뒤 후속 확인)가 옛 경로에 중복 파일 생성, (c) 데일리 노트 플러그인의 템플릿 적용 레이스. **SnackShot 노트·미디어는 영구히 이동하지 않는다** — 위키링크가 이름 기반이므로 사용자 일기가 어디로 아카이빙되든 임베드가 유지되고, 미디어 경로 재작성 플러그인과도 충돌하지 않는다.

### Result — 트레이드오프

- **얻은 것:** 기존 git 백업 워크플로우 무변경, 데스크탑에서 영상 임베드 재생되는 일기 관리, 앱 구현 범위 최소화(전송 로직 없음).
- **잃은 것:** Syncthing 설치·설정이라는 외부 전제, 옵시디언에서의 편집이 보존되지 않음(단방향), 동기화 지연은 Syncthing 정책에 의존.
- **재검토 조건:**
    - 옵시디언에서 트랜스크립트 편집 욕구가 생기면 양방향 설계(frontmatter 버전 키 + 관리 구간 분리) 별도 ADR.
    - Syncthing-Fork 유지보수 중단 시 대체 전송(BasicSync 등) 검토.
    - 옵시디언 공식 Sync 구독 시 전송 경로 단순화 재검토.

---

## ADR-027: 결정 추출 프롬프트·구조화 출력 정책

**Status:** accepted **Date:** 2026-06-11

### Situation

Phase 6(AI 라벨링) 진입. ADR-006의 "좁은 기준" 결정 추출을 Gemini 2.5 Flash-Lite(ADR-008)로 구현하려면 프롬프트 문구, 환각 방어, 프롬프트 관리 방식을 정해야 한다 (미결정 사항 2번). 참고: Gemini 2.0 라인은 2026-06-01 서비스 종료되어 2.5 Flash-Lite 선택이 여전히 유효함을 확인했다.

### Task

(1) 프롬프트를 어디서 관리하고 어떻게 튜닝할지, (2) AI 환각(특히 evidence 날조)을 어떻게 차단할지, (3) 응답 스키마 범위를 정한다.

### Action — 최종 선택

1. **프롬프트 SoT는 코드** — `src/services/label/prompts.ts`. settings 오버라이드를 두지 않는다. 본인 사용 도구에서 코드 수정이 곧 설정이고, git이 프롬프트 변경 이력을 추적한다. 시스템 프롬프트 + few-shot 3개(긍정 2, 부정 1) + 사용자 메시지 빌더로 구성.
2. **3중 환각 방어:**
   - Gemini `generationConfig.responseSchema` (+ `responseMimeType: 'application/json'`)로 출력 구조를 API 레벨에서 강제
   - Zod `safeParse` 2차 검증 (ADR-021)
   - **evidence verbatim 검증**: 코드가 `transcript.includes(evidence)`를 검사해 원문에 없는 evidence를 가진 후보는 **폐기하고 로그** — 가장 흔한 환각 패턴(근거 날조)의 데이터 유입을 차단
3. **응답 스키마 범위 (v1):** `hasDecision`, `decisions[{summary, category, reasoning, alternatives, expectedOutcome, evidence, confidence, followUpAfterDays}]`. 자문에서 제안된 `verifiability`/`emotionalState`/`topics`는 **보류** — decisions 테이블에 대응 컬럼이 없고, 감정/주제 라벨은 entries.metadata_json 확장(ADR-011)으로 별도 결정할 사안.
4. **followUpAfterDays → followUpAt 변환**: 핸들러가 `recordedAt + days × 86,400,000ms`로 계산, `followUpSetBy='ai'` (ADR-017).
5. **재시도 정책**: Zod 파싱 실패 시 temperature를 높여 1회 재시도, 재실패 시 throw (잡 큐의 attempts 소진 흐름에 위임).

### Result — 트레이드오프

- **얻은 것:** 환각이 DB에 닿기 전 3중 차단, 프롬프트 이력 추적, Inbox 컨펌(ADR-006)과 합쳐 4중 방어.
- **잃은 것:** 앱 내에서 프롬프트 실험 불가(코드 수정 필요), evidence 폐기 정책이 과하면 진짜 결정을 놓칠 수 있음(로그로 모니터링).
- **재검토 조건:** evidence 폐기율이 높으면 "유사 일치 허용(공백/조사 차이)"으로 완화. 감정/주제 라벨링 욕구가 생기면 metadata_json 확장 별도 ADR. 프롬프트 실험이 잦아지면 settings 오버라이드 재검토.

---

## 미결정 / 보류 사항

다음 항목들은 추후 구현 시 결정한다:

1. **"하루 경계" 기본값** (자정 vs 새벽 4시). 설정에서 변경 가능하게는 두되 기본값은 사용 후 결정.
2. ~~결정 추출 프롬프트의 정확한 문구.~~ → **ADR-027로 결정** (2026-06-11). 본문은 `src/services/label/prompts.ts`가 SoT.
3. **Decision Inbox 알림 정책.** 즉시 알림? 1일 1회 모음? 사용 후 결정.
4. ~~옵시디언 export 포맷.~~ → **ADR-026으로 결정** (2026-06-11).
5. **백업/복원 전략.** 본인 사용 도구지만 데이터 손실 대비 필요.
6. **압축 시 코덱/비트레이트 정확한 값.** 시험해보고 결정.

---

## 변경 이력

|날짜|변경|비고|
|---|---|---|
|2026-05-19|초안 작성 (ADR-001 ~ ADR-017)|프로젝트 킥오프|
|2026-06-11|파일명 오타 수정 (ShackShot→SnackShot), ADR-024 추가 (FK 비활성), ADR-012/014 구현 노트 추가|하네스 감사 후속|
|2026-06-11|ADR-025 추가 (android/ 보존 정책 — Expo Config Plugin)|위젯 prebuild 영구화|
|2026-06-11|ADR-026 추가 (옵시디언 연동 — SAF export + Syncthing), 미결정 4번 해소|옵시디언 연동 설계|
|2026-06-11|ADR-026 노트 단위 변경 (클립당 1개 → 하루당 1개, 전체 재생성 멱등 방식)|사용자 결정 — 2단계 사용 피드백|
|2026-06-11|ADR-004 구현 노트 추가 (원본 vault 보관 → ADR-026으로 대체)|3단계 감사에서 발견한 ADR 간 충돌 해소|
|2026-06-11|ADR-027 추가 (결정 추출 프롬프트·구조화 출력 정책), 미결정 2번 해소, prompts.ts 작성|Phase 6 착수 준비|
|2026-06-12|ADR-026 개정 — 데일리 노트 파일명 `-snackshot` suffix, 기존 일기와 임베드 통합 방식 결정|사용자 일기와의 위키링크 충돌 + 아카이빙 워크플로 호환|
