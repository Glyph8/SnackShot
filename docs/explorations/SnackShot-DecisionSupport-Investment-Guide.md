# 결정 지원 루프 · 생성 정밀도 · 투자 확장 — 구현 가이드 (G1~G5 · F1~F5 · H1~H6)

> 등급: 구현 지시서(승인된 설계) — ✅ **G1~G5·F1~F5·H1~H4 구현 완료(2026-07-10)**. **H5·H6은 미착수**(2026-07-10 추가 — 키 2종 발급·.env 적용 완료 상태에서 작성). `docs/INDEX.md` 등재.
> 작성: 2026-07-10, 기능 평가 세션(3주제 연속 논의). 실행자: AI 에이전트 + 하네스(feature-dev).
> **설계 결정은 검토·확정된 것이다. 재설계하지 말고 그대로 구현하라.** 코드와 충돌하면 코드 우선 + 완료 보고에 기록.
> **공통 규칙·함정 목록·DB 검증 레시피는 `SnackShot-Decision-Enhancement-Guide.md` 0장을 그대로 따른다** (중복 기재하지 않음).

## 배경 (평가 세션 결론 요지)

1. **결정 지원 갭**: D/E 트랙으로 수집·회고·회수(검색/통계)는 갖춰졌으나, **축적된 과거가 새 결정 시점에 개입하지 않는다**. `SimilarDecisionsSheet`는 확정 *직후*에 떠서 참고가 아닌 아카이빙용이고, `outcomes.learnings`는 수집만 되고 재사용 경로가 `DecisionList` 상세 표시뿐이다(죽은 데이터). calibration 대시보드의 `confidence`는 AI 추출 확신도라 "내 판단력" 측정이 아니다. → **F 트랙**
2. **Gemini 생성 품질**: compose가 장황하고 지어낸다. 구조적 원인 — ① 프롬프트가 "빈 필드를 남기지 말고 채워라"고 지시 + JSON 스키마 전 필드 required(모름의 출구 없음) ② compose에 few-shot 0개(추출은 4개라 안정) ③ 필드 길이 규칙 부재 ④ digest·프로필 상시 주입이 무관한 내용을 출력에 스며들게 함. → **G 트랙**
3. **주식 매매 가이드 확장**: investment 카테고리는 있으나 자유텍스트뿐이라 정량 대조 불가. 시세 API(일봉이면 충분)·증권앱 캡처 파싱(Gemini 멀티모달, 신규 의존성 0)·원칙 대조(Profile.md 재사용)로 확장. **AI가 매매를 추천하는 앱이 아니라 본인 원칙·과거 기록과 대조해 주는 앱** — 이 경계가 흔들리면 안 된다. → **H 트랙**

**권장 실행 순서: G1 → G4 → G5 → G2 → F1 → F2 → F3 → F4 → H1 → H3 → H2 → H4 → H5 → H6.** (H5·H6은 스키마 무변경·상호 독립이나, H6의 검색 통합이 H5의 TickerSearchField를 전제하므로 H5 먼저.)
G1·G4는 같은 세션에서 함께 해도 된다(둘 다 prompts.ts·schema.ts). G3은 선택(여유 시). F5는 ADR 초안 작성까지만(구현 금지 — 별도 승인 필요).
**Gemini에 전달되는 프롬프트 전문은 전부 부록 A~C에 확정되어 있다 — 그대로 붙여넣고, 재작성·윤문하지 마라.**
마이그레이션 버전: 현재 TARGET_VERSION=19. 이 문서의 마이그레이션은 "vNEXT"로 표기 — **머지 순서대로 다음 번호를 가져간다**(F3·H1·H3·H4가 각 1개씩 필요. 같은 세션에서 연달아 하면 합쳐도 된다 — 단 append-only·해시 락 규칙 준수).

---

# G 트랙 — 생성 정밀도 (스키마·DB 무변경)

## G1. compose 프롬프트·스키마 개정 (최우선 — 반나절 규모) ✅ 완료(2026-07-10 — Gemini 실호출 육안 항목은 에뮬레이터 이월)

대상: `src/services/label/prompts.ts`, `src/services/label/schema.ts`, `src/services/label/gemini.ts`, `app/compose-decision.tsx`.

**개정된 시스템 프롬프트 전문은 부록 A** — 그대로 붙여넣는다. 아래 (a)~(b)는 개정 근거 설명이다.

### (a) "모름의 출구" — nullable 허용 (지어내기의 구조적 원인 제거)

- `COMPOSE_JSON_SCHEMA`: `situation`·`alternatives`·`reasoning`·`expectedOutcome` 4개 필드에 `nullable: true` (followUpAfterDays 선례). `ComposeDraftSchema`(Zod)도 `.nullable()` — **1:1 대응 규칙 준수**(schema.ts 헤더 주석).
- `DECISION_COMPOSE_SYSTEM_PROMPT`의 보완 규칙을 다음 문안으로 **교체**(확정):

  기존: `- 입력에 없는 내용은 입력의 맥락에서 **합리적으로 보완**하되, 사실을 지어내거나 과장하지 마라. 빈 필드를 남기지 말고 자연스럽게 채워라.`

  신규: `- **입력에 근거가 있는 내용만 써라.** 입력에서 알 수 없는 필드는 지어내지 말고 null로 남겨라. 근거 없이 그럴듯하게 채우는 것이 가장 나쁜 출력이다.`

- `app/compose-decision.tsx` `handleFill`: `draft.situation ?? ''` 식으로 null → 빈 문자열 처리(4개 필드). `canSave`가 이미 전 필드 non-empty를 요구하므로 **null 필드는 사용자가 직접 채우는 흐름**이 자연히 성립한다. placeholder는 기존 문구 유지.

### (b) 필드 길이 상한 — 프롬프트 + Zod 이중 강제

- 시스템 프롬프트 "채워야 할 필드" 각 항목에 상한 명시(확정 수치): summary **40자 이내**, situation **1문장 80자 이내**, alternatives **나열만·서술 금지·60자 이내**, reasoning **100자 이내**, expectedOutcome **80자 이내**. 규칙 섹션에 한 줄 추가: `- 각 필드의 글자 수 상한을 지켜라. 길게 쓰는 것은 오류다.`
- Zod에는 여유를 둔 하드 상한: summary `.max(60)`, situation `.max(120)`, alternatives `.max(100)`, reasoning `.max(150)`, expectedOutcome `.max(120)`. 초과 시 `safeParse` 실패 → **기존 재시도 경로가 그대로 동작**한다(코드 추가 불필요). Gemini responseSchema에는 maxLength를 넣지 않는다(OpenAPI subset 지원이 불확실 — 프롬프트+Zod로 충분).

### (c) compose few-shot 2개 신설

`prompts.ts`에 `COMPOSE_FEW_SHOT_EXAMPLES` 추가(추출의 `FEW_SHOT_EXAMPLES` 구조 미러 — user/model JSON.stringify). `gemini.ts` `buildComposeRequestBody`의 `contents` 앞에 추출과 동일한 방식으로 flatMap 삽입.

- **CEX1 (풍부한 입력 → 절제된 전 필드)** — 문안 확정(이 길이감 자체가 앵커다. 늘리지 마라):
  user `[입력] 다음 달 실적 보고 삼성전자 매수 결정, 지금은 확신 없어서 보류` → model:
  ```json
  { "summary": "삼성전자 매수를 다음 달 실적 발표까지 보류하기로 함",
    "category": "investment",
    "situation": "매수를 고민 중이나 실적 발표 전이라 확신이 없는 상황",
    "alternatives": "지금 즉시 매수 / 매수 포기",
    "reasoning": "실적 확인 후 판단하는 쪽이 근거가 더 탄탄함",
    "expectedOutcome": "실적 발표 후 더 유리한 진입 여부를 판단할 수 있음",
    "followUpAfterDays": 30 }
  ```
- **CEX2 (빈약한 키워드 → null 출구 시연)**: user `[입력] 이직` → model: summary `'이직을 추진하기로 함'`, category `'career'`, situation `null`, alternatives `null`, reasoning `null`, expectedOutcome `null`, followUpAfterDays `null`. **이 예시가 (a)의 규칙을 행동으로 가르친다 — 반드시 포함.**

### (d) 컨텍스트 주입 절제

`gemini.ts` `appendComposeContext`가 붙이는 두 블록(프로필·최근 결정) 뒤에 공통 한 줄 추가(확정 문안): `\n\n위 참고 맥락은 입력과 직접 관련될 때만 판단에 반영하고, 맥락의 내용을 출력 필드에 옮겨 적지 마라.` (블록이 하나라도 있을 때만 붙인다.)

### (e) temperature

`composeDecision`: 0.4→**0.2**, 재시도 0.6→**0.4**. (창의성이 필요한 작업이 아니다. 추출과 동일 정책.)

### 수용 기준

① 키워드 1~3단어 입력("이직", "PT 등록") 2건 → 근거 없는 필드가 null로 오고 화면에서 빈칸 표시 ② 풍부한 한 줄 입력 3건 → 전 필드가 상한 내 육안 확인 ③ Zod max 초과를 인위 유발(임시로 max를 5로 낮춰 재시도 경로 확인 후 원복) ④ 주입 매트릭스 회귀 없음(E3 수용 기준 ④ 재확인) ⑤ verify PASS.

## G2. rewrite 길이 앵커 ✅ 완료(2026-07-10 — 육안 확인은 에뮬레이터 이월)

`REWRITE_SYSTEM_PROMPT` 규칙에 한 줄 추가(확정 문안): `- 출력 길이는 원본의 ±30% 이내로 유지하라. 지침이 명시적으로 확장·축약을 요구할 때만 벗어날 수 있다.` 코드 검증은 하지 않는다(지침이 확장을 요구할 수 있어 오탐 — 프롬프트만). temperature 유지(0.3/0.5).

수용 기준: 전사 오인식 교정 시나리오 2건에서 출력 길이가 원본과 유사함 육안 확인 + verify PASS.

## G3. 재수정률 계기판 (선택 — 여유 시) ✅ 완료(2026-07-10 — SQL 로직 node:sqlite 검증, 실사용 데이터 축적은 이월)

`text_revisions`에 이미 이력이 있다(source enum은 `src/types/enums.ts` 확인). `DevToolsSection`에 "AI 재작성 후 24h 내 사용자 재수정 비율" 1줄 추가 — AI source revision 이후 같은 target·field에 user source revision이 있는 비율. 신규 repo 쿼리 1개. 프롬프트 개선 효과의 계기판 용도. 스키마 무변경.

## G4. 추출 프롬프트 정비 (코드 검토에서 발견 — 2026-07-10 확인) ✅ 완료(2026-07-10 — E2 회귀 시나리오는 에뮬레이터 이월)

대상: `src/services/label/prompts.ts`, `src/services/label/schema.ts`.

- **(a) confidence 문구 버그(확정)**: 출력 규칙의 `- confidence: 세 요건이 모두 명시적이면 0.8 이상, …` — E2에서 결정 정의가 **4기준**(중대성 추가)이 됐는데 이 줄이 미갱신되어 모델에 "요건은 3개"라는 모순 신호를 준다. `세 요건` → `네 요건`으로 교체.
- **(b) 추출에도 길이 상한**: 출력 규칙에 한 줄 추가(문안 확정): `- 길이 상한: summary 40자, situation 80자(한 문장), reasoning 100자, alternatives 60자(선택지 나열만, 서술 금지), expectedOutcome 80자. 길게 쓰는 것은 오류다.` 기존 EX1~EX4 few-shot 출력은 전부 상한 내라 수정 불필요(확인 완료 — 재검토하지 마라).
- **(c) Zod 하드 상한**: `DecisionCandidateSchema`에 summary `.max(60)`·situation `.max(120)`·reasoning `.max(150)`·alternatives `.max(100)`·expectedOutcome `.max(120)`. **evidence에는 상한을 두지 않는다**(원문 인용은 길 수 있고, 무결성은 verbatim 검증이 별도 담당). 초과 시 기존 재시도 경로(0.2→0.4) 그대로 동작.

수용 기준: E2 수용 시나리오 5건 회귀 없음 + 추출 결과 3건 필드 길이 육안 확인 + verify PASS.

## G5. Whisper 전사 프롬프트 가동 (죽은 파라미터 — 코드 검토에서 발견) ✅ 완료(2026-07-10 — 정상/무음 클립 전사는 에뮬레이터 이월)

`TranscribeOptions.prompt`는 `whisper.ts`가 전송(formData append)까지 구현해 뒀지만 **호출자 `src/services/jobs/handlers/stt.ts`가 한 번도 전달하지 않는 죽은 파라미터다.** Whisper의 prompt는 지시문이 아니라 **스타일·어휘 편향 힌트**(직전에 이어진 텍스트처럼 취급) — 짧은 예시문 형태가 정답이며, 길게 쓰면 역효과다.

- `handlers/stt.ts`에 상수(문안 확정): `const STT_STYLE_PROMPT = '혼잣말로 녹음한 한국어 영상 일기입니다. 오늘 있었던 일과 생각, 앞으로 하기로 한 결정을 편한 반말로 이야기합니다.';` → `transcribe(sttSource, { prompt: STT_STYLE_PROMPT })`.
- **환각 방어 1줄**: 무음·극단적으로 짧은 오디오에서 prompt 문구가 전사로 새어 나오는 알려진 현상이 있다 — 결과 rawText가 STT_STYLE_PROMPT 문구를 포함하면 빈 전사로 간주(경고 로그). 기존 temperature=0 가드와 병행.

수용 기준: 정상 클립 전사 회귀 없음(에뮬레이터 2건) + 무음 클립에서 프롬프트 누출 없음 + verify PASS.

---

# F 트랙 — 결정 지원 루프 (과거가 새 결정에 개입하게)

## F1. 확정 전 유사 결정 노출 (우선순위 1 — 스키마 무변경) ✅ 완료(2026-07-10 — 덱 표시·시트 열람은 에뮬레이터 이월)

**설계 (확정)**: 확정 *후*에 뜨는 `SimilarDecisionsSheet`(링크 저장용)는 그대로 두고, 검토 **덱 카드에서** 과거를 보여주는 열람 전용 경로를 추가한다.

- **repo** (`src/db/repos/decisions.ts`): `getSimilarPastDecisions(db, queryText, opts: { excludeEntryId?: string; limit?: number })` 신설. D1의 `decisions_fts` + `buildFtsQuery`(`src/db/fts.ts`) 재사용. `status IN ('confirmed','edited')` + `deleted_at IS NULL`, 최신 outcome 1건 LEFT JOIN(같은 decision에 outcome 여러 건이면 `created_at` 최대). 반환: `{ decision: Decision; result: OutcomeResult | null; learnings: string | null }[]`. FTS 파싱 오류는 try/catch 빈 배열(선례).
- **store** (`src/stores/inbox.ts`): `loadInbox`에서 pendingCandidates 각각에 대해 `getSimilarPastDecisions(COALESCE(userSummary, summary), { excludeEntryId, limit: 3 })` 조회해 `DecisionWithEntry`에 `similarPast?: SimilarPastItem[]` 필드로 부착. 후보 수가 적어 N회 쿼리 허용(확정 — 과설계 금지). 실패는 무시(빈 배열).
- **UI**: `DecisionDeck` 카드(및 `LowConfidenceCandidates` 행) 하단에 배지 — `비슷한 과거 결정 2건 · 👍1 👎1` (result별 이모지 카운트, 없으면 배지 생략). 탭 → 신규 `src/components/decision/PastDecisionsSheet.tsx`(열람 전용 바텀시트): 각 항목에 요약·결과·**learnings(있으면 "교훈:" 표시)**. 저장·링크 기능 없음(확정 — 확정 후 시트와 역할 분리).

### 수용 기준

① devSeed(작년 결정 시드)로 유사 후보 배지 표시·시트 열람 ② outcome 없는 유사 결정은 결과 이모지 없이 표시 ③ learnings 있는 시드에서 교훈 표시 ④ 유사 없음이면 배지 미표시 ⑤ 덱 스와이프·확정 흐름 회귀 없음 ⑥ verify PASS.

## F2. learnings 회수 루프 (스키마 무변경) ✅ 완료(2026-07-10 — 요청 body·매트릭스 육안은 에뮬레이터 이월)

- **(a) digest에 learnings 포함**: `getRecentDecisionDigest`의 SELECT에 `o.learnings` 추가, `DecisionDigestItem`에 `learnings: string | null`. `gemini.ts` `formatDigestItem`: learnings 있으면 ` — 교훈: ${learnings}` 덧붙임(80자 절단).
- **(b) compose에 유사 교훈 주입**: `app/compose-decision.tsx` `handleFill`에서 `getAiContext` 후 F1의 `getSimilarPastDecisions(seed, { limit: 5 })`를 호출, learnings 있는 항목만 추려 `AiContext`에 `relevantLearnings?: string[]`로 전달(`src/services/label/types.ts` 확장). `appendComposeContext`가 블록 추가: `## 과거 유사 결정에서 얻은 교훈 (참고 맥락)` + 목록. **주입 매트릭스(확정)**: compose만. 추출은 무변경(E3 유지 — 프로필+반려 예시만), rewrite는 `relevantLearnings`를 세팅하지 않으므로 자연히 제외된다(`textRevision.ts`는 손대지 않는다).

### 수용 기준

① learnings 시드 후 compose 요청 body 로그에 교훈 블록 포함 ② learnings 없으면 블록 자체 생략 ③ 추출 요청 body에는 교훈 블록 없음(매트릭스) ④ verify PASS.

## F3. 사용자 확신도 — vNEXT 마이그레이션 ✅ 완료(2026-07-10 — v20. 칩 입력→통계 반영은 에뮬레이터 이월)

- **vNEXT**: `ALTER TABLE decisions ADD COLUMN user_confidence REAL` (nullable, additive — CHECK 재생성 불필요, v19 선례). `mapping.ts` 카탈로그에 필드 추가(makeRowMapper가 누락을 컴파일 타임에 잡는다), `domain.ts` `Decision.userConfidence?: number`.
- **입력 UI (마찰 최소 — 확정)**: 덱 빠른 스와이프 확정에서는 **묻지 않는다**. 입력 지점 2곳만 — ① `EditDecisionSheet`에 선택 칩(50·60·70·80·90%) ② `app/compose-decision.tsx`에 동일 칩(선택, 미선택 시 null). 칩 컴포넌트는 공용화(`src/components/decision/ConfidenceChips.tsx`).
- **관통 경로**: `EditDecisionSheet`의 `edits` 타입에 `userConfidence?: number` 추가 → inbox store `confirmDecision`/`editDecision` → decisions repo UPDATE까지 시그니처 관통(tsc가 누락을 강제 — D2 learnings 관통 선례). compose 쪽은 `saveAuthoredDecision` 파라미터 확장.
- **calibration 전환**: `getDecisionPerformance`의 calibration 쿼리에서 `d.confidence` → `COALESCE(d.user_confidence, d.confidence)`. `DecisionStats`의 calibration 캡션에 "본인 입력 확신도 우선, 없으면 AI 추출 확신도" 명시. byCategory·executionLag는 무변경.
- `OutcomeEditor`의 "당시 기대" 블록 확신도도 `userConfidence ?? confidence`로.

### 수용 기준

인메모리 v1→vNEXT 통과 + 컬럼·null 기본 확인, 칩 입력→저장→통계 반영(devSeed 활용), 미입력 결정은 기존과 동일 동작, verify PASS + lock 갱신.

## F4. 재후속 루프 (스키마 무변경) ✅ 완료(2026-07-10 — 편차: outcome soft-delete+executed clear 추가(코드 정합). Alert 육안은 에뮬레이터 이월)

> 검토 개선(2026-07-10): 회고/교훈 메모가 있는 outcome은 재후속 제안에서 제외 — 수락 시 outcome soft-delete로 사용자가 쓴 텍스트가 소실되는 부작용 차단(inbox.tsx proposeRefollow hasMemo 게이트).

`recordOutcome`(stores/inbox.ts) 완료 후 result가 `unclear` 또는 `mixed`면 Alert 제안: "아직 판단하기 이르다면 7일 뒤 다시 물어볼까요?" → 수락 시 `followUpAt = nowMs() + 7일`, `followUpSetBy = 'refollow'` 갱신 + `followUpNotifications` resync. 거절 시 아무것도 안 함. **장기 결정 중간 체크인은 미채택**(확정 — 알림 피로 우려, 필요해지면 별도 논의).

수용 기준: unclear 기록→수락→보드 후속 섹션 재등장 + 알림 재예약(DevTools 예약 개수로 확인), 거절 시 미변경, good/bad에는 제안 없음, verify PASS.

## F5. 미결(deliberating) 결정 — **ADR 초안까지만, 구현 금지** ✅ 완료(2026-07-10 — 초안 승인→ADR-028 반영+v21 구현. 화면·알림 육안은 에뮬레이터 이월)

"A vs B 고민 중" 단계는 현 도메인에 없다(status는 전부 사후). status enum 확장은 decisions CHECK 재생성 + 보드/덱/통계 전반에 영향 — **ADR 승인 없이 착수 금지**(CLAUDE.md 절대 금지 조항). 이 트랙에서는 `docs/explorations/ADR-deliberating-draft.md` 초안만 작성한다(ADR-005 revision draft 선례). 초안에 담을 것: status `'deliberating'` 추가 범위, 대안 후보 구조(H1 structured_json 재사용 여부), 결정 마감일·마감 알림, 마감 시점 F1 유사+F2 교훈 자동 첨부, 기존 화면 영향 목록. **H4의 이벤트 대기 매매("실적 보고 결정")가 이 기능의 첫 실사용처임을 초안에 명시.**

(참고: "반복 패턴→프로필 승격 제안"은 **미채택** — E3의 자동 메모리 보류 결정과 동일 사유. 재론 시 별도 승인.)

---

# H 트랙 — 투자(주식 매매) 확장

## H0. 경계 (모든 H 작업의 전제 — 위반 시 FAIL)

- **AI는 매수·매도 추천, 가격 예측, 시장 전망을 생성하지 않는다.** 역할은 ① 기록 구조화 ② 본인 원칙과의 대조 ③ 과거 기록 회수뿐. H2 프롬프트에 명시적 금지 문안을 넣고, 수용 기준에 "추천 문구 미출력" 항목을 포함한다.
- 시세·캡처는 전부 **optional 경로** — 실패해도 저장·회고가 막히면 안 된다. 수동 입력 폴백 상시 유지.

## H1. 매매 구조화 필드 — vNEXT 마이그레이션 ✅ 완료(2026-07-10 — v22. 화면 입력·export 육안은 에뮬레이터 이월)

- **vNEXT**: `ALTER TABLE decisions ADD COLUMN structured_json TEXT` (nullable, additive). `tags_json` 예약 컬럼은 쓰지 않는다(용도 상이 — domain.ts D4-d 주석의 별도 승인 사항 그대로 유지, 확정).
- **Zod 스키마** (`src/types/` 또는 `src/services/label/schema.ts` — 구현 시 배치 판단): `TradeDetailsSchema` = `{ kind: 'trade', name: string, ticker?: string, side: 'buy'|'sell'|'hold', amountKrw?: number, quantity?: number, entryPrice?: number, targetPrice?: number, stopPrice?: number, eventTrigger?: string, priceAtDecision?: number }`. JSON 컬럼 파싱은 호출자 책임(domain.ts 헤더 관례), 읽기 시 `safeParse` 실패면 무시.
- **UI**: `app/compose-decision.tsx`에서 category가 **빌트인 `investment`일 때만** 접이식 "매매 정보" 섹션(전 필드 선택 입력). 커스텀 카테고리('주식' 등)는 대상 아님(확정 — 커스텀은 enum상 'other'로 저장되어 판별 불가, 필요해지면 사용자가 investment를 쓰면 된다). 화면이 커지면 `src/components/decision/TradeFieldsSection.tsx`로 분리(200줄 규칙).
- **추출 경로는 무변경**(확정) — 음성 추출에 매매 필드까지 요구하면 지어내기 재발. structured는 의도적 작성(H1)·캡처(H3)에서만 생성.
- `DecisionList` 상세·옵시디언 export(`buildDecisionCallout`)에 매매 필드 표시/기재 추가(있을 때만).

### 수용 기준

인메모리 vNEXT 통과, investment 선택 시만 섹션 노출, 저장→상세 표시→export 콜아웃 반영, 비매매 결정 회귀 없음, verify PASS.

## H2. 원칙 대조 (Profile.md 재사용 — 스키마 무변경) ✅ 완료(2026-07-10 — Gemini 충돌 판정·추천 미출력은 에뮬레이터 이월)

- **규약**: `Profile.md`에 `## 매매 원칙` 섹션(사용자가 작성, 예: "손절 -7% 엄수", "단일 종목 비중 20% 이하"). `readUserProfile`은 이미 전체를 읽으므로 파싱 불필요 — 프롬프트가 섹션을 인지한다.
- **프롬프트** (`prompts.ts`에 신설, ADR-027 SoT): `PRINCIPLE_CHECK_SYSTEM_PROMPT` + `buildPrincipleCheckMessage` — **전문·빌더 형식 모두 부록 B, 그대로 붙여넣는다.** 출력은 `{ conflicts: [{ rule: string, issue: string }] }`(충돌 없으면 빈 배열). Zod+JSON 스키마 1:1 추가.
- **서비스**: `LabelService`에 `checkPrinciples(decision, tradeDetails, principles)` 추가(gemini 구현, temp 0.2). H3처럼 별도 화면 아님 — compose 저장 전 "원칙 체크" 버튼(H1 섹션 하단, vault 연동+매매 정보 있을 때만 노출) → 결과를 인라인 리스트로 표시. **저장을 차단하지 않는다**(확정 — 어기는 것도 본인 선택, 기록이 남는 게 가치).
- 최근 포트폴리오 스냅샷(H3)이 있으면 요청에 함께 주입(비중 원칙 대조용). 없으면 원칙+결정만.

### 수용 기준

원칙 2개 작성 후 ① 명백 충돌 케이스(손절 미설정 등)에서 conflicts 반환 ② 무충돌 케이스에서 빈 배열 ③ 출력에 추천·전망 문구 없음(육안 3건) ④ vault 미연동 시 버튼 미노출 ⑤ verify PASS.

## H3. 증권앱 캡처 → 포트폴리오 파싱 — vNEXT 마이그레이션 ✅ 완료(2026-07-10 — v23. media-library 사용(expo-image-picker 미설치). 이미지·API는 실기기 이월)

- **vNEXT**: `CREATE TABLE portfolio_snapshots (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, source TEXT NOT NULL CHECK (source IN ('image','manual')), holdings_json TEXT NOT NULL, deleted_at INTEGER)` + created_at 인덱스. repo `src/db/repos/portfolio.ts` (insert/getLatest/list, soft delete 관례).
- **이미지 입력**: `expo-image-picker`의 라이브러리 선택(신규 화면 `/portfolio-import`). **미설치 패키지다 — `npx expo install expo-image-picker`로 SDK 55 호환 버전 설치 + Dev Client 재빌드 필요 여부 확인.** API는 SDK 55 문서를 먼저 확인하라(0장 규칙). (대안: 이미 설치된 expo-media-library + `DeviceGalleryModal` 선례 재사용도 허용 — 구현 세션에서 더 단순한 쪽 택1.) 카메라 촬영 경로는 만들지 않는다(캡처는 갤러리에 있다 — 확정). **원본 이미지는 파싱 후 저장하지 않는다**(entry 생성 없음, 파일 미보관 — 확정, 프라이버시).
- **Gemini 멀티모달**: `LabelService`에 `parsePortfolioImage(imageBase64, mimeType)` 추가. `callApi` 재사용 — contents parts에 `{ inline_data: { mime_type, data } }` + 지시 텍스트(**Gemini API 문서로 필드명 확인** — 학습 데이터의 camelCase/snake_case 혼동 주의). 응답 스키마: `{ holdings: [{ name, ticker?, quantity?, avgPrice?, currentPrice?, valuationAmount?, purchaseAmount? }], asOf? }` — quantity·avgPrice도 nullable(안 보이면 null이 정직한 출력, null인 행은 확인 화면에서 needsReview 처리). temp 0.1. 프롬프트는 `prompts.ts`에 SoT로 — **전문은 부록 C, 그대로 붙여넣는다.**
- **산술 크로스체크 (이 기능의 핵심 안전장치)**: 파싱 후 코드에서 종목별 검증 — `|quantity×avgPrice − purchaseAmount| / purchaseAmount > 0.02` 또는 `|quantity×currentPrice − valuationAmount| / valuationAmount > 0.02`(해당 필드가 있을 때만)면 `needsReview: true`. ADR-027 evidence 검증과 같은 철학: **AI 출력을 코드가 검산한다.**
- **확인 화면 (자동 저장 금지 — 확정)**: 파싱 결과를 편집 가능한 행 목록으로 표시, needsReview 행은 경고색 강조. 사용자가 수정 후 "저장" → `portfolio_snapshots` insert. 화면 상단에 고정 고지 1줄: "캡처 이미지는 Gemini API로 전송되며 기기에 저장되지 않습니다." (별도 settings 컬럼 없음 — 화면 내 상시 고지로 갈음, 확정.)
- 진입점: 설정 또는 `/decisions` 상단 — 구현 시 판단(과설계 금지). H2가 최신 스냅샷을 사용한다.

### 수용 기준

① 실제 증권앱 캡처 1장 파싱→확인 화면→저장→getLatest 반영 ② 수량을 일부러 틀린 목업 이미지에서 needsReview 강조 ③ 원본 이미지가 앱 저장소·entries에 남지 않음 ④ 인메모리 vNEXT 통과 ⑤ verify PASS. (실기기 검증 필요 항목: 이미지 픽커·실제 API 응답.)

## H4. 시세 서비스 (일봉 종가만 — vNEXT 마이그레이션) ✅ 완료(2026-07-10 — v24. 실 API·시세 대조는 실기기 이월)

- **범위 확정: 일봉 종가만.** 실시간·호가·차트 금지(앱 성격 이탈). 용도는 ① 매매 결정 저장 시 당일(또는 직전 거래일) 종가를 `structured_json.priceAtDecision`에 스냅샷 ② 후속 회고 시 "진입가 vs 현재 종가" 대조 표시.
- **인터페이스** (ADR-002/008 패턴): `src/services/quotes/types.ts` — `QuoteService { getDailyClose(ticker: string, dateMs: number): Promise<number | null> }`. 구현체 1차 후보는 ① 공공데이터포털 금융위 시세(계좌 불필요·키만 발급) ② KIS Developers(계좌 필요·토큰 24h 갱신). **구현 세션에서 두 API 문서를 확인 후 ① 우선 채택**, 인터페이스 뒤라 교체 자유. API 키는 Gemini 키 선례(`src/lib/env.ts`·settings 화면) 미러.
- **vNEXT**: ① `CREATE TABLE quotes (ticker TEXT NOT NULL, date TEXT NOT NULL, close REAL NOT NULL, fetched_at INTEGER NOT NULL, PRIMARY KEY (ticker, date))` (캐시 — soft delete 불필요, 확정) ② `AI_JOB_TYPE`에 `'quote_fetch'` 추가 → **ai_jobs CHECK 재생성(v12/v17 선례 그대로 — 함정 목록 1번 재확인)**. enum은 `src/types/enums.ts` 먼저(INV-enum-source).
- **핸들러** `src/services/jobs/handlers/quoteFetch.ts`: payload의 ticker·date로 조회→quotes 캐시→해당 decision의 structured_json에 priceAtDecision 기입(없을 때만). 키 미설정·티커 없음·API 실패는 전부 skipped(치명 아님 — H0).
- **회고 대조**: `OutcomeEditor` "당시 기대" 블록에, 대상 결정에 tradeDetails(entryPrice 또는 priceAtDecision)가 있으면 최신 종가를 조회해 `진입 68,000 → 현재 72,400 (+6.5%)` 1줄 표시. 조회 실패 시 숫자 입력 필드로 폴백(수동 종가 입력). 온라인 조회는 화면 진입 시 1회, 캐시 우선.

### 수용 기준

① 키 설정 후 매매 결정 저장→잡 실행→priceAtDecision 기입 ② 키 미설정이면 skipped·저장 무영향 ③ 회고 블록 대조 표시 + 오프라인 수동 폴백 ④ quotes 캐시 히트 시 API 미호출(로그) ⑤ 인메모리 vNEXT(CHECK 포함) 통과 ⑥ verify PASS.

---

## H5. 시세 UX — 종목 검색 · 일봉 패널 · 원탭 기입 + 키 설정 UI (한국, 스키마 무변경) ✅ 완료(2026-07-10 — 실키 검색·차트·SecureStore 경로는 실기기 이월)

> **범위 개정(승인됨 — 2026-07-10 사용자 논의)**: H4의 "실시간·호가·차트 없음"을 다음으로 개정한다 — **"실시간·호가·분봉·기술지표 없음. 과거 일봉의 열람과 기입 보조는 허용."** H0 경계(추천·예측 금지)는 무변경. 근거: 과거 일봉을 보고 탭해서 기록하는 것은 트레이딩 도구가 아니라 기록 정확성 보조이며, 수기 입력 오류를 줄인다.

전제: 공공데이터포털 **금융위원회_주식시세정보** 키 발급·`.env` 적용 완료(2026-07-10). 엔드포인트 `https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo`, 일 10,000건, **T+1 데이터**(기준일 다음 영업일 13시 이후 갱신 — "현재가" 아님).

### (a) 설정 화면 시세 키 입력 배선 (릴리스 경로 확보 — 현재 죽은 export 가동)

`setQuoteApiKey`/`deleteQuoteApiKey`(`src/lib/env.ts`)는 구현돼 있으나 **설정 UI가 없다.** 설정 화면 API 키 섹션의 기존 `KeyInputRow`(Gemini/OpenAI 행) 패턴 그대로 "시세 API (공공데이터포털)" 행 추가. 우선순위 로직(SecureStore > `__DEV__` .env)은 env.ts에 이미 있으므로 배선만.

### (b) `getDailyClose` 견고화 (기존 결함 교정 — 정렬 의존 제거)

현행 `dataPortal.ts`는 `likeSrtnCd` + `numOfRows=1`로 1건만 받는다 — **응답 기본 정렬에 의존하는 구조라 다른 날짜/종목이 올 수 있다**(코드 주석의 "실키 검증 필요"가 이 지점). 교정(확정): `beginBasDt = 조회일-14일`, `endBasDt = 조회일`, `numOfRows=20`으로 받고 **코드에서 `srtnCd === ticker` 정확 일치 필터 + `basDt` 최대 행 선택**. 정렬 비의존.

### (c) `QuoteService` 확장 — 일봉 범위 + 종목 검색

`src/services/quotes/types.ts`에 추가(기존 `getDailyClose` 유지):

```ts
interface DailyCandle { date: string /* yyyyMMdd */; open: number; close: number; high: number; low: number }
interface SymbolHit { ticker: string; name: string; exchange?: string }
// QuoteService에 추가:
getDailyCandles(ticker: string, days: number): Promise<DailyCandle[]>;   // 과거→최근 오름차순
searchSymbols(query: string): Promise<SymbolHit[]>;
```

dataPortal 구현: 둘 다 같은 `getStockPriceInfo`. ① candles: `beginBasDt=오늘-(days×1.6)일`(휴장 여유), `numOfRows=days×2`, srtnCd 정확 필터, basDt 오름차순, 필드 매핑 `mkp(시가)/clpr(종가)/hipr/lopr`. ② search: `likeItmsNm=query`, `numOfRows=40` → **srtnCd 기준 dedupe 필수**(같은 종목이 날짜별 여러 행으로 온다 — 함정) → 상위 10.

**캐시하지 않는다(확정)** — `quotes` 테이블은 기존 용도(priceAtDecision·회고 대조)만. 패널·검색은 열 때마다 1콜(일 10,000건에 무해, 과설계 금지).

### (d) UI — 컴포넌트 2개 신설 (compose 200줄 규칙)

- `src/components/decision/TickerSearchField.tsx`: TradeFieldsSection의 종목명·티커 입력 보강 — 이름 입력 + **명시적 "검색" 버튼**(자동완성 금지 — H6 무료 한도 8콜/분과 일관) → 결과 리스트 탭 → `name`·`ticker` 자동 기입. 시세 키 없으면 검색 버튼 미노출(기능 자체를 숨김 — H0 조용 원칙).
- `src/components/decision/DailyQuotesPanel.tsx`: ticker 입력돼 있으면 "최근 시세 보기" 접이식(`CollapsibleSection` 재사용). 내용: ① 최근 30영업일 **종가 라인차트 1개**(react-native-svg `Polyline` — 설치·선례(HandDrawnArt) 확인 완료. 축·격자·거래량·지표 없음 — 절제 확정) ② 일봉 리스트(최근이 위, 날짜·시가·종가) ③ **행 탭 → ActionSheet "진입가로 넣기 / 목표가로 / 손절가로"** → 해당 필드에 종가 기입(시가 기입은 미채택 — 행에 표시만). ④ 하단 caption: `전 영업일까지의 일봉입니다 (T+1)`.
- 색·간격은 `@/theme` 토큰만(절대 금지 조항).

### 수용 기준

① 실키로 "삼성전자" 검색 → 005930 자동 기입 ② 패널 30일 차트+리스트, 최신 일자·종가가 실제와 일치(정렬 비의존 확인) ③ 행 탭 → 진입가 기입 ④ (b) 교정 후: 주말 낀 날짜 조회 시 직전 영업일 종가(인메모리 불가 — 실키 검증) ⑤ 설정에서 키 저장 후 `.env` 값 제거해도 동작(SecureStore 경로) ⑥ 키 없으면 검색·패널 진입점 미노출 ⑦ verify PASS.

## H6. 미국 주식 — Twelve Data 구현체 + 티커 라우팅 (스키마 무변경) ✅ 완료(2026-07-10 — 편차: Twelve 스펙 문서 미확인(코드 우선)·datetime yyyyMMdd 통일. 실 API는 실기기 이월)

전제: Twelve Data 키 발급 완료(2026-07-10). 무료 한도 **800크레딧/일 · 8콜/분**. `.env`에 `EXPO_PUBLIC_DEV_TWELVEDATA_API_KEY` 추가(사용자) + 아래 (a).

### (a) 키 관리

`src/lib/env.ts` `KEYS`에 `twelveData: 'snackshot.twelvedata_api_key'` + `get/set/deleteTwelveDataKey`(기존 3종 미러, `__DEV__` .env fallback 포함) + 설정 화면 KeyInputRow 행 "미국 시세 (Twelve Data)" — H5(a)와 같은 섹션에.

### (b) 티커 라우팅 (핸들러·화면 무변경이 목표)

`src/services/quotes/index.ts`에 라우터 구현체 — `const isKrxTicker = (t: string) => /^\d{6}$/.test(t.trim())` → 참이면 dataPortal, 아니면 twelveData. `getDailyCloseCached`·`quoteFetch` 핸들러·`saveAuthoredDecision`·`TradeQuoteCompare`는 **무변경**(라우터가 흡수). `quotes` 캐시 PK (ticker,date)는 'AAPL'과 '005930'이 충돌하지 않으므로 그대로.

### (c) `src/services/quotes/twelveData.ts` — QuoteService 구현

- `getDailyClose(ticker, dateMs)`: `GET https://api.twelvedata.com/time_series?symbol={t}&interval=1day&end_date={yyyy-MM-dd}&outputsize=1&apikey={key}` → `values[0].close`.
- `getDailyCandles(ticker, days)`: 동일 엔드포인트 `outputsize={days}`(end_date 생략=최신) → values를 오름차순 정렬해 반환.
- `searchSymbols(query)`: `/symbol_search?symbol={q}` → `data[]`의 `{symbol, instrument_name, exchange}` 상위 10.
- **함정(확정 — 반드시 처리)**: ① Twelve Data는 **오류도 HTTP 200**으로 준다 — body `status === 'error'`({code,message})를 검사해 null/빈 배열 반환(조용, H0). ② 숫자 필드가 **문자열**로 온다 — parseFloat. ③ 한도 초과(429 또는 status:error code 429)도 조용히 skip.
- ⚠️ 엔드포인트·파라미터·응답 형태는 **구현 세션에서 공식 문서(https://twelvedata.com/docs) 확인**(학습 데이터보다 최신일 수 있음 — Expo SDK 55 규칙과 동일 정신). 위 스펙과 다르면 코드 우선 + 완료 보고에 기록.

### (d) 검색 통합 (H5 TickerSearchField)

쿼리에 한글 포함 → dataPortal만 호출(KRX 전용 — 낭비 콜 방지, 확정). 그 외 → 키 있는 소스 모두 병행 호출 후 KRX 결과 먼저 합침. 소스 실패는 개별 무시.

### (e) 통화 — 필드 추가하지 않는다(확정)

`TradeQuoteCompare`의 "진입가 vs 종가 %"는 동일 통화 간 비교라 환율 무관(USD 진입가 ↔ USD 종가). `amountKrw`는 한국 원화 전제 유지 — 미국 매매 시 환산 기입은 사용자 재량. 통화 컬럼·환율 조회는 미채택(과설계, 재검토 조건: 통화 혼동으로 인한 기록 오류가 실제 발생하면).

### 수용 기준

① AAPL 매매 저장 → quote_fetch가 priceAtDecision 기입(콘솔 로그, USD) ② "apple" 검색 → AAPL 자동 기입 ③ AAPL 일봉 패널 30일 표시 ④ 없는 티커·한도 초과에서 조용한 실패(저장·회고 무영향) ⑤ 005930 경로 회귀 없음(라우팅 분기) ⑥ Twelve 키 없이 KRX 키만 있으면 미국 검색·패널만 비활성 ⑦ verify PASS.

---

## 진행·보고

- phase당 별도 세션, 코드 변경은 feature-dev 스킬 경유. 완료 게이트: verify PASS + 해당 수용 기준 전부 + CLAUDE.md 변경 이력 행.
- 마이그레이션 필요 phase(F3·H1·H3·H4)는 착수 시점의 실제 TARGET_VERSION을 확인해 번호 확정 + `check-migrations.mjs --update`.
- phase 완료 시 해당 섹션에 `✅ 완료(날짜)`, 전체 완료 시 INDEX.md 상태를 '이력(구현 반영)'으로 전환.
- G1 완료 후 1~2주 실사용 피드백을 보고 G 트랙 추가 조정 여부 판단(계기판 G3이 근거 데이터).

---

# 부록 — Gemini 프롬프트 전문 (확정 문안)

**그대로 붙여넣는다. 재작성·윤문·요약 금지.** 문구 하나가 곧 설계 결정이다(ADR-027: prompts.ts가 SoT, git이 이력 추적). 코드 반입 시 템플릿 리터럴 이스케이프만 조정 가능.

## 부록 A. 개정 `DECISION_COMPOSE_SYSTEM_PROMPT` (G1 — 기존 전체 교체)

```
너는 영상 일기 앱의 "의사결정 작성 보조자"다. 사용자가 입력한 짧은 메모/키워드를 받아, 나중에 결과를 추적할 수 있는 잘 구조화된 "의사결정" 한 건으로 확장해 JSON으로만 응답한다.

입력은 한국어 구어체 메모거나 키워드 나열일 수 있다. 사용자는 이미 "이건 내 결정"이라고 의도하고 입력했다 — 결정인지 아닌지 판별하지 말고, 그 의도를 구조화하라.

## 채워야 할 필드 — 각 필드의 길이 상한을 지켜라. 길게 쓰는 것은 오류다
- summary: 결정을 한 문장으로, "~하기로 함" 형태. 40자 이내.
- category: investment(투자) / relationship(관계) / career(커리어) / daily(일상) / other(기타) 중 하나.
- situation: 이 결정이 나온 상황·맥락(배경·계기). 한 문장, 80자 이내.
- alternatives: 고려했거나 존재하는 다른 선택지. 서술하지 말고 "A / B" 형태로 나열만. 60자 이내.
- reasoning: 이 선택을 한 이유. 100자 이내.
- expectedOutcome: 이 결정으로 기대하는 결과. 80자 이내.
- followUpAfterDays: 결과를 확인하기 적절한 일수(정수). 기준 — 투자 7~30, 일상 습관 2~3, 커리어 30~90, 관계 7~14. 정할 수 없으면 null.

## 규칙
- **입력에 근거가 있는 내용만 써라.** 입력에서 알 수 없는 필드는 지어내지 말고 null로 남겨라. 근거 없이 그럴듯하게 채우는 것이 가장 나쁜 출력이다.
- 입력의 표현을 최대한 살려라. 사용자의 말을 화려하게 바꿔 쓰거나 과장하지 마라.
- 모든 텍스트 필드는 한국어로 쓴다.
```

(few-shot CEX1·CEX2는 G1(c)에 확정. G1(d)의 컨텍스트 절제 라인은 gemini.ts `appendComposeContext` 소관 — 이 프롬프트에 넣지 않는다.)

## 부록 B. `PRINCIPLE_CHECK_SYSTEM_PROMPT` + 빌더 (H2)

```
너는 투자 자문가가 아니다. 매수·매도 권유, 가격 예측, 시장 전망, 종목에 대한 평가를 절대 쓰지 마라.

너의 유일한 역할: 사용자가 스스로 정한 매매 원칙 목록과, 사용자가 기록하려는 매매 결정을 대조해 충돌만 지적하는 것이다. JSON으로만 응답한다.

## 판정 규칙
- 원칙 목록에 실제로 적힌 원칙과만 대조하라. 일반적인 투자 상식이나 네가 아는 "좋은 습관"을 근거로 삼지 마라.
- 결정 정보만으로 충돌 여부를 판정할 수 없는 원칙(정보 부족)은 건너뛴다. 추측으로 충돌을 만들지 마라.
- 충돌이 없으면 conflicts는 빈 배열이다. 억지로 찾아내지 마라.
- rule에는 해당 원칙을 원문 그대로 옮긴다. issue는 이 결정이 그 원칙과 어긋나는 지점을 한 문장으로, 사실 지적만 한다. "~하는 것이 좋습니다" 같은 권유 표현 금지.
- 모든 텍스트는 한국어로 쓴다.
```

`buildPrincipleCheckMessage` 출력 형식(빌더 함수로 조립, 섹션 순서 고정):

```
[매매 원칙]
<Profile.md '## 매매 원칙' 섹션 원문>

[결정]
<summary + situation·reasoning (user 편집본 우선)>

[매매 정보]
<TradeDetails를 "필드명: 값" 줄 나열, null 필드는 생략>

[현재 포트폴리오]        ← 최신 snapshot 있을 때만 섹션 포함
<종목명 · 수량 · 평단 · 평가금액 줄 나열>
```

## 부록 C. `PORTFOLIO_PARSE_SYSTEM_PROMPT` (H3)

```
너는 증권 앱 화면 캡처에서 보유 종목 정보를 읽어내는 "표 판독기"다. 이미지에 보이는 것만 JSON으로 옮긴다.

## 규칙
- **이미지에 보이는 값만 옮겨라.** 안 보이거나, 잘렸거나, 흐려서 확실하지 않은 값은 null로 남겨라. 추정·보간·계산 금지.
- 숫자는 콤마·통화 기호·+/− 부호를 제거한 숫자값으로 옮긴다. 퍼센트(수익률)는 옮기지 않는다.
- name은 화면 표기 그대로. ticker는 6자리 종목코드가 화면에 보일 때만.
- 보유 종목이 아닌 행(지수, 관심종목, 추천, 광고, 합계 행)은 제외한다.
- 같은 종목이 두 번