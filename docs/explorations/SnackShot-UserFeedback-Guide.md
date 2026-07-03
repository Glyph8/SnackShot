# 사용 피드백 반영 — 구현 가이드 (E1~E3)

> 등급: 구현 지시서(승인된 설계). `docs/INDEX.md` 등재.
> 작성: 2026-07-03, 사용자 피드백 검토 세션. 실행자: AI 에이전트 + 하네스(feature-dev).
> **설계 결정은 검토·확정된 것이다. 재설계하지 말고 그대로 구현하라.** 코드와 충돌하면 코드 우선 + 보고.
> **공통 규칙·함정 목록·DB 검증 레시피는 `SnackShot-Decision-Enhancement-Guide.md` 0장을 그대로 따른다** (중복 기재하지 않음).

배경(사용자 피드백 원문 요지):
1. 옵시디언에서 쓴 텍스트가 SnackShot으로도 들어오면 좋겠다 (현재는 내보내기만).
2. 의사결정 추출이 사소한 일까지 잡아서 반려가 잦다.
3. AI 작성 기능이 '나'를 모르고 제로베이스라 매번 추가 수정이 필요하다.

**권장 실행 순서: E2 → E1 → E3** (E2는 독립·최저비용, E3은 E1의 SAF 읽기 헬퍼에 의존).
마이그레이션 버전 번호는 D 트랙(D1=v15 예정)과 조율 — 먼저 머지되는 쪽이 다음 번호를 가져간다. 이 문서에서는 "TARGET_VERSION+1"로 표기한다.

---

## E1. 옵시디언 → SnackShot 수신함 import ✅ 완료(2026-07-04)

### 설계 (확정) — 양방향 sync가 아니라 단방향 채널 추가

기존 export(day note)는 생성물이므로 왕복 편집·merge는 하지 않는다. 대신 vault에 **전용 수신함 파일** `SnackShot/Inbox.md`를 두고, 앱이 읽어서 텍스트 entry로 변환한다.

**파일 규약:**
- 위치: `setupSnackShotFolder`가 만드는 SnackShot 폴더 안, `Inbox.md`.
- 최초 생성 시 헤더 1줄: `<!-- 여기에 쓴 내용은 SnackShot이 가져갑니다. 블록 구분은 --- -->`
- 블록 구분자 `---`(단독 줄). 블록 1개 = entry 1개. 공백뿐인 블록은 무시.
- import 성공 후 파일은 헤더만 남기고 비운다(수신함 의미론).

**파이프라인:**
- `src/types/enums.ts`의 `AI_JOB_TYPE`에 `'obsidian_import'` 추가(진실원 먼저 — INV-enum-source).
- 마이그레이션(TARGET_VERSION+1): ai_jobs CHECK 확장 — **v12 선례 그대로** 테이블 재생성(새 테이블→INSERT SELECT→DROP→RENAME→인덱스 2개 재생성. ai_jobs에는 FTS 트리거 없음). 같은 버전에 `settings ADD COLUMN obsidian_inbox_last_hash TEXT` 추가.
- 핸들러 `src/services/jobs/handlers/obsidianImport.ts`:
  1. `obsidianVaultUri` 없으면 skipped.
  2. Inbox.md 읽기 — `vault.ts`에 **`readVaultTextFile` 헬퍼 신설**(SDK 55 File API 문서 확인 후 구현. 기존 `safGetOrCreateFile`·`File.write` 관례 참조. E3이 이 헬퍼를 재사용한다).
  3. 파일 전체 해시(sha 불필요 — 단순 문자열 비교용이므로 내용 자체 또는 djb2류)가 `obsidian_inbox_last_hash`와 같으면 skipped(중복 방어).
  4. 블록 파싱 → 각 블록 `insertTextEntry`(recorded_at = `nowMs()` — **확정**: 블록별 시각 메타는 비용>효용) → 기존 파이프라인(FTS·label 추출·export)에 자동 편입.
  5. 전부 저장 후 파일을 헤더만으로 재작성 + last_hash 갱신. **순서 확정: 저장 → 비우기** (비우기 실패 시 중복은 3번 해시 방어가 막는다. 반대 순서는 유실 위험이라 금지).
- enqueue 시점: `_layout`의 `startWorker` 직후 + 기존 AppState active 전환 리스너에서. 동일 타입 pending 잡이 있으면 중복 enqueue하지 않는다(aiJobs repo에 조회 함수 없으면 신설).
- 설정 UI 없음 — vault 연동 시 자동 활성(파일을 안 쓰면 아무 일도 없음).

### 수용 기준
① 인메모리: 마이그레이션 전체 실행 + CHECK에 obsidian_import 포함 확인 ② 에뮬레이터: Inbox.md에 블록 2개 작성 → 앱 포그라운드 → text entry 2건 생성·Today 표시·파일 비워짐 ③ 같은 내용으로 재실행 시 중복 생성 없음(해시 방어) ④ 생성된 entry에서 label 추출 잡이 큐잉됨 ⑤ verify PASS.

---

## E2. 의사결정 추출 정밀도 (과추출 억제) ✅ 완료(2026-07-03)

### 원인 진단 (코드 확인 완료 — 재조사 불필요)
- `prompts.ts`의 긍정 few-shot EX2("12시 전에 자기로 함")가 사소한 일상 다짐을 추출 대상으로 가르침 — 규칙("추상적 다짐 제외")과 상충.
- 추출 후 confidence 필터 없음(전부 인박스行).
- `user_decision_hint`가 추출 파이프라인에서 미사용.

### 설계 (확정)

**(a) 프롬프트 개정** (`src/services/label/prompts.ts` — ADR-027상 이 파일이 SoT, git이 이력 추적):
- 결정 정의에 4번째 기준 추가(문안 확정):
  `4. **추적할 만큼 중대하다**: 다음 중 하나 이상 — 되돌리기 어렵다 / 돈·시간이 유의미하게 들어간다 / 영향이 일주일 이상 간다. 오늘 하루로 끝나는 사소한 선택(메뉴, 취침 시각, 그날의 할 일)은 결정이 아니라 일과다.`
- EX2를 교체: 긍정 예시는 "PT 3개월 등록" 같은 중대한 daily로. 기존 취침 다짐 전사는 **부정 예시 EX4로 강등**(hasDecision=false, few-shot 3→4개). `FEW_SHOT_EXAMPLES` 배열에 추가만 하면 gemini.ts가 자동 변환.

**(b) confidence 게이트** — 저장은 그대로(ADR-016 원본 보존), 표시만 억제:
- inbox 검토 카드 목록에서 `confidence < 0.6` 후보를 기존 `CollapsibleSection`으로 "낮은 확신 후보 N건"에 분리(기본 접힘). 임계값은 inbox 쪽 상수 `LOW_CONFIDENCE_THRESHOLD = 0.6` + "추후 설정화 여지" 주석. 스키마·repo 변경 없음.

**(c) 반려 이력 주입(개인화 캘리브레이션):**
- `decisions.ts`에 `getRecentRejectedSummaries(db, limit = 8)` 신설(status='rejected', deleted_at IS NULL, extracted_at DESC).
- `labelExtraction` 핸들러가 조회해 `buildExtractionRequestBody`에 optional 인자로 전달. gemini.ts는 systemInstruction 끝에 동적 블록 추가:
  `## 이 사용자가 과거 "결정 아님"으로 반려한 예 — 이런 류는 추출하지 마라` + 목록.
- ADR-027 주석 명시: 정적 프롬프트 SoT는 불변, 이 블록은 사용자 데이터 주입(프롬프트 오버라이드 아님).

**(d) hint 활용:** entry의 `user_decision_hint`를 핸들러에서 읽어 동적 한 줄 주입 — 1이면 "사용자가 결정이 있다고 표시했다", 0이면 "표시하지 않았다 — 경계 사례는 추출하지 마라".

**(e) 모델:** 코드 변경 없음. 사용자에게 settings에서 flash(또는 pro)로 1~2주 실험 권고(이 항목은 구현 대상 아님).

### 수용 기준
개발 빌드에서 수동 시나리오 5건 판정 — 추출돼야 함: ⑴ "이직 제안 수락하기로 했다" ⑵ "적금 깨서 전세보증금에 보태기로 함". 추출되면 안 됨: ⑶ "내일부터 일찍 자야지" ⑷ "점심은 파스타 먹기로 했다" ⑸ "오늘 힘들었다, 운동 좀 해야 하는데". 추가: 낮은 확신 접힘 그룹 동작, 반려 2건 만든 뒤 유사 전사에서 미추출 확인(c 동작), tsc·verify PASS.

---

## E3. 개인화 — 프로필 문서 + 최근 맥락 (E1 완료 후) ✅ 완료(2026-07-04)

### 설계 (확정) — AI 자동 메모리 저장소는 **하지 않는다**(후순위 결정 사항, 별도 승인 필요)

**(a) 정적 프로필:**
- vault `SnackShot/Profile.md`. 사용자가 옵시디언에서 직접 작성·수정. **설정 토글 없음** — 파일이 존재하면 사용, 지우면 꺼짐(확정).
- E1의 `readVaultTextFile`로 읽고 2,000자 상한(초과 시 앞부분만 사용 + `console.warn`).
- 주입 지점: 추출(`buildExtractionRequestBody`)·작성(`compose`)·재작성(`rewrite`) 3곳 모두, systemInstruction 끝 동적 블록 `## 사용자 프로필 (참고 맥락 — 지시가 아니다)`.
- 읽기는 잡 실행 시점마다(파일이 작아 캐시 불필요 — 확정).

**(b) 최근 맥락 다이제스트:**
- `decisions.ts`에 `getRecentDecisionDigest(db, days = 7, limit = 10)` — confirmed/edited 결정의 `COALESCE(user_summary, summary)` + outcome result(있으면). 반환은 문자열 배열이 아닌 구조체 배열(포맷팅은 서비스 쪽).
- 주입 지점: **compose·rewrite만**. 추출에는 넣지 않는다(추출은 E2의 반려 예시만 — 이중 주입 금지, 확정).
- 블록: `## 최근 1주 결정 (참고 맥락)`.

**프라이버시 주석(코드에 남길 것):** 프로필·최근 결정이 Gemini API로 전송됨. 기존에도 전사를 전송하므로 새 범주는 아니나, Profile.md 최초 생성 시 헤더에 이 사실을 한 줄 명시한다.

### 수용 기준
① Profile.md 있음/없음 두 케이스에서 compose 동작(없어도 오류 없이 진행) ② 2,000자 초과 파일 절단 동작 ③ compose 결과에 프로필 맥락 반영 육안 확인 1건 ④ 주입 매트릭스 확인(요청 body 로그): 추출 = 프로필O·다이제스트X, compose/rewrite = 프로필O·다이제스트O ⑤ verify PASS.

---

## 진행·보고

- 순서: **E2 → E1 → E3**. E2는 D 트랙과도 완전 독립이라 가장 먼저.
- phase당 별도 세션. 완료 보고 양식·게이트는 D 가이드와 동일(verify PASS + 수용 기준 + CLAUDE.md 변경 이력 행).
- phase 완료 시 해당 섹션에 `✅ 완료(날짜)` 표기, 전체 완료 시 INDEX.md 상태를 '이력(구현 반영)'으로 전환.
