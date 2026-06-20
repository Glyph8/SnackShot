# [초안] ADR-005 개정 — 녹화 일시정지/이어찍기

> 등급: 탐색/제안(draft). **승인 전까지 SnackShot-ADR.md(권위)에 반영하지 않는다.**
> 승인 시: 아래 "개정 블록"을 ADR-005 본문 끝(`### Result` 다음, `---` 앞)에 추가하고, CLAUDE.md 변경 이력·`docs/INDEX.md`를 갱신한 뒤 구현에 착수한다.
> 작성일: 2026-06-20

---

## 왜 개정이 필요한가 (요약)

현재 한 모먼트는 **한 호흡으로만** 녹화된다(`record.tsx`·`record-audio.tsx`, `MAX_SECS=180`, `MIN_SECS=3`). 생각을 정리하려 잠깐 멈추면 처음부터 다시 찍어야 해서 "간편한 캡처" 가치와 충돌한다. 일시정지/이어찍기를 도입하되, ADR-005의 3분 상한 취지(용량·STT 비용·처리 시간 통제)는 유지해야 한다 — 그래서 **임의 변경이 아니라 ADR 개정**으로 처리한다.

## 타당성 (설치된 SDK 55 타입·네이티브 코드 재조사 결과)

- **오디오 — 가능**: `expo-audio`의 `AudioRecorder.pause()` + `record()`(재개).
- **영상 — 가능(조건부)**: `expo-camera@55.0.18`의 **`CameraView.toggleRecordingAsync()`** 가 진행 중 녹화를 **일시정지↔재개**(단일 토글)한다(`CameraView.d.ts:137` "Pauses or resumes the video recording"; Android `ExpoCameraView.kt`의 `it.pause()/it.resume()`, iOS `toggleRecording` 확인). 단 **iOS는 iOS 18+에서만** 동작하며, 가용 여부는 `getSupportedFeatures().toggleRecordingAsyncAvailable`로 확인해야 한다. → **ffmpeg 세그먼트 병합 불필요.**

> ⚠️ **정정:** 이 문서의 직전 버전에서 "영상 일시정지 불가(`pauseRecording` 없음)"라고 적었으나, 실제 API 이름이 `toggleRecordingAsync`였고 영상도 지원된다. 재조사로 바로잡는다.
> ⚠️ 구현 착수 전 SDK 55 문서(https://docs.expo.dev/versions/v55.0.0/)로 재확인(CLAUDE.md 규칙: SDK 55는 학습 데이터보다 최신).

---

## 개정 블록 (승인 시 ADR-005에 추가할 텍스트)

### Revision (2026-06-20): 일시정지/이어찍기 도입 + 상한 재정의

**Status:** proposed **Date:** 2026-06-20

#### Situation

즉흥 녹화 중 생각을 정리하거나 잠시 멈췄다 이어가고 싶은 수요가 있으나, 현재는 한 호흡 녹화만 가능해 멈추면 처음부터 다시 찍어야 한다.

#### Task

일시정지/이어찍기를 도입하되 3분 상한의 취지(용량·STT 비용·처리 시간 통제)를 유지한다. 플랫폼별 네이티브 지원 차이를 정직하게 반영한다.

#### Action — 검토한 대안

| 대안 | 내용 | 평가 |
|------|------|------|
| 1. 현행 유지 | 일시정지 없음 | 단순하나 유연성 부족 |
| 2. 오디오만 도입 | 영상 보류 | 안전하지만 오디오·영상 비대칭 |
| **3. 오디오 + 영상(조건부)** | 영상은 `toggleRecordingAsyncAvailable`일 때만 노출 | **양쪽 일관 경험 + 네이티브 지원 활용, ffmpeg 불필요 (선택)** |

#### Action — 최종 선택

1. **일시정지/이어찍기를 오디오·영상 모두 도입.**
   - 오디오: `expo-audio` `pause()` / `record()`.
   - 영상: `CameraView.toggleRecordingAsync()`. `getSupportedFeatures().toggleRecordingAsyncAvailable === false`(예: iOS 18 미만)면 일시정지 버튼을 **graceful히 숨긴다** — 녹화·정지·저장은 그대로 동작.
2. **"3분 상한 · 3초 하한"을 누적 녹화 시간(일시정지 구간 제외) 기준으로 재정의.** 일시정지 중 타이머·`maxDuration` 카운트 정지. 저장 `durationMs`=누적.
3. 별도 ffmpeg 병합 불필요 — 네이티브 토글이 단일 파일로 처리.

#### Result — 트레이드오프

- **얻은 것:** 오디오·영상 모두 끊고 이어가는 유연성, 상한 정의 명확화(벽시계가 아닌 누적 기준), 추가 네이티브 의존 없음.
- **잃은 것:** iOS 18 미만에서는 영상 일시정지 미제공(기능 게이팅으로 흡수). 일시정지/이어찍기 분의 누적 시간 회계 복잡도 약간 증가.
- **영향 범위:** `app/record-audio.tsx` + `app/record.tsx`(일시정지↔재개 토글, 영상은 capability 게이팅), 누적 타이머·상한 판정, 저장 `durationMs`=누적. DB 스키마·마이그레이션 무변경.
- **재검토 조건:** iOS 18 미만 사용자 비중이 크면 안내 카피 보완. maxDuration의 일시정지 시간 포함 여부가 SDK에서 바뀌면 누적 로직 재점검.

#### 구현 노트 (참고)

- **영상**: 마운트 시 `getSupportedFeatures()`로 `toggleRecordingAsyncAvailable`를 확인 → true일 때만 일시정지 토글 노출. `toggleRecordingAsync()`는 활성 녹화가 있을 때만 효과.
- **상한 판정**: `maxDuration`이 일시정지 시간을 포함하는지 SDK 동작이 불확실 → 직접 누적 타이머(일시정지 시 정지)로 상한을 판정하고, 도달 시 수동 `stopRecording()`. 구현 시 콘솔 로그로 동작 확인.
- 녹화 화면: 녹화 중 **[일시정지] ↔ [재개]** 토글 + 별도 **정지(저장)**. 일시정지 상태 시각 표시(REC 점멸 정지 등), 타이머는 누적 시간 표시. 오디오 레벨미터(`LevelMeter`)는 일시정지 중 `active=false`로 정지.

---

## 승인 요청

이 방향(대안 3: 오디오 + 영상 조건부)으로 진행해도 될까요? 승인하시면 위 개정 블록을 ADR-005에 반영하고(CLAUDE 변경 이력·`docs/INDEX.md` 갱신), `record-audio.tsx`·`record.tsx`에 일시정지/이어찍기 + 누적 상한 + 영상 capability 게이팅을 구현한 뒤 `npm run verify`까지 돌리겠습니다.
