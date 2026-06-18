> **상태: 탐색(미구현) — Inbox 리스트 모드 제거 + 위젯 TodoList 도입 설계 제안** · 비규범(non-canonical) · 관련 ADR: 003(클립 1급), 006/016/017(결정·컨펌·후속), 012(잡 큐), 014(soft delete)
> 이 문서는 의사결정/탐색 기록이다. 코드 작성의 진실원이 아니다 — 규칙은 CLAUDE.md를 따른다.

# Inbox 리스트 모드 → 위젯 TodoList 전환 — 설계 제안 (구현 전 조사)

> 목적: Inbox 탭의 **리스트 모드를 제거**하고 그 자리를 **TodoList**로 대체한다. 위젯에서 간단히 **쓰고·보고·체크**할 수 있어야 하며, **기존 결정(decision) 파이프라인·통계 확장**과의 연계를 고려한다. 본 문서는 3가지 방향을 비교하고 권장안을 제시한다. (구현 X)

---

## 0. 요구사항 정리

1. Inbox 탭의 두 표시 모드(`deck`/`list`) 중 **`list` 제거**. `deck`(결정 스와이프 컨펌)은 유지.
2. 그 자리에 **TodoList** 기능 도입.
3. **위젯**에서 todo를 간단히 작성·확인·체크.
4. 기존 기능(결정 추출·컨펌·후속 확인·옵시디언) 및 **향후 "의사결정 도움 + 통계화" 확장**과 자연스럽게 연결.

---

## 1. 현재 구조 사실관계 (grounding)

설계는 아래 실제 코드/스키마 위에서만 유효하다.

**Inbox.** `app/(tabs)/inbox.tsx` + `src/stores/inbox.ts`. `viewMode: 'deck' | 'list'`(`InboxViewMode`)를 `ViewToggle`로 전환. Inbox는 두 묶음을 보여준다 — **검토 대기**(`status='extracted'` 결정)와 **후속 확인**(`confirmed`/`edited` + `follow_up_at` 도래 + outcome 없음, ADR-017). `deck`은 `DecisionDeck`, `list`는 `DecisionCard` + `FollowUpCard`. 배지 = 검토대기수 + 후속수.

**결정 도메인.** `decisions`(AI 원본/사용자 편집 분리 ADR-016, status extracted/confirmed/rejected/edited, category, confidence, follow_up_at, outcome_id, tags_json, soft delete), `outcomes`(result/reflection/learnings), **`decision_links`(decision↔decision 연관, "Stage 2 연관 분석"용으로 이미 존재)**, `ai_jobs`(DB 잡 큐 ADR-012; `outcome_followup` 잡 타입은 **정의만 있고 미구현** — `queue.ts`에서 skip).

**위젯.** `plugins/widget/` — **정적 RemoteViews 런처**다. 영상/음성/직접쓰기 3버튼이 딥링크(`snackshot://record` 등)로 앱을 띄울 뿐, **앱 데이터를 읽지 않는다.** 앱→위젯 데이터 브리지(SharedPreferences/ContentProvider/컬렉션 위젯)는 **아직 없다.** Config Plugin이 prebuild 후 Kotlin/리소스를 복원한다.

**제약(불변식).** 마이그레이션은 **append-only, 버전드, 해시락**(현재 target **v7** → 신규 테이블/컬럼은 **v8 추가** + `migrations.lock.json` 갱신). repo는 `makeRowMapper` 기반, enum은 `src/types/enums.ts` 단일 진실원, UI는 `@/theme` 토큰만, `npm run verify`(tsc+불변식+마이그레이션) 통과 필수. 시각은 UTC ms, ID는 ULID, snake_case↔camelCase는 repo에서. **ADR-003: 클립(Entry)이 1급 객체** — decisions는 `entry_id NOT NULL`로 항상 엔트리에 매달려 있다.

---

## 2. 두 개의 횡단 결정축

세 제안은 아래 두 축의 조합이다. 먼저 축을 분리해 둔다.

### 축 A — 데이터 모델: todo를 "어디에" 둘 것인가
- **(A1) 독립 `todos` 테이블** — 결정과 분리된 새 엔티티.
- **(A2) 기존 `decisions`/follow-up에 흡수** — todo = 가벼운 결정/액션.
- **(A3) 독립 테이블 + 결정 연결 브리지** — 평소 독립, 필요 시 `decision_id`로 연결.

### 축 B — 위젯 인터랙션 수준 (기술 현실)
위젯에서 "보고·체크"하려면 정적 런처로는 부족하다. 단계별 비용이 다르다.

- **(B1) 딥링크 전용(최소 네이티브).** 위젯은 "＋할 일" 버튼만. 탭 → 앱의 빠른 todo 화면. **위젯 안에서 목록/체크는 불가.** 기존 위젯 패턴 그대로라 비용 최저.
- **(B2) 스냅샷 읽기 위젯(중간).** 앱이 todo 변경 시 **SharedPreferences(또는 공유 JSON)** 에 상위 N개를 기록 → 위젯이 텍스트로 표시. 체크는 항목 탭 시 딥링크로 앱에서 처리(위젯 자체 토글은 아님). RemoteViews 갱신은 앱이 `AppWidgetManager.updateAppWidget` 호출.
- **(B3) 컬렉션 위젯 + 인앱 체크백(최대).** `RemoteViewsService`/`RemoteViewsFactory`로 위젯 안에 스크롤 목록 + 각 행 체크박스. 체크 → `BroadcastReceiver`가 공유 스토어 갱신 후 위젯 리프레시, 앱 기동 시 SQLite와 **재동기화(reconcile)**. expo-sqlite DB는 위젯 프로세스에서 직접 읽기 어렵기 때문에 **공유 스토어(SharedPreferences/JSON) 브리지가 사실상 필수**다. 가장 "진짜 위젯 투두"지만 Kotlin 작업량·동기화 복잡도 최대. (대안: `react-native-android-widget` 라이브러리 — 위젯 저작 모델을 JS로 바꾸지만 기존 Kotlin 위젯과 이원화됨.)

> 권고: 위젯은 **B1 → B2 → B3 단계적**으로. 데이터 모델 제안과 독립적으로 진행할 수 있다.

### Inbox 리스트 모드 제거 (세 제안 공통, 소규모)
`stores/inbox.ts`의 `InboxViewMode`에서 `'list'` 제거(→ 사실상 토글 폐기 또는 `'deck' | 'todo'`로 재정의), `inbox.tsx`의 `ViewToggle`·`list` 분기·`DecisionCard` 경로 제거, `DecisionDeck`(컨펌)만 유지. **후속 확인(FollowUpCard)은 리스트 모드의 일부였으므로 deck 상단 섹션 또는 todo 뷰로 재배치 필요** — 이 재배치 위치가 제안별로 갈린다.

---

## 3. 제안 A — 독립 `todos` 테이블 (느슨한 결합)

### 개요
결정과 분리된 순수 할 일 목록. todo는 자체 생명주기를 가지며, 결정과는 (지금은) 무관.

### 구현 방법
- **DB (마이그레이션 v8):** `todos(id ULID, title TEXT, done INTEGER 0/1, done_at INTEGER, due_at INTEGER NULL, sort_order INTEGER, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`. soft delete, UTC ms. 인덱스: `(done, sort_order)`, `(due_at) WHERE deleted_at IS NULL`.
- **repo:** `src/db/repos/todos.ts` — `makeRowMapper<Todo>` 카탈로그, `insertTodo/listTodos/toggleTodo/reorderTodos/softDeleteTodo`.
- **타입/enum:** `src/types/domain.ts`에 `Todo`. 상태가 단순(done bool)이라 enum 불필요.
- **store:** `src/stores/todos.ts`(zustand) — 낙관적 토글, 정렬.
- **UI:** Inbox 토글을 `deck`(결정) / `todo`로 재정의. todo 뷰 = 입력 한 줄 + 체크 리스트(today의 `TodayComposer` 패턴 재사용). 후속 확인 섹션은 deck 상단에 상주.
- **위젯:** B1(즉시) → B2(상위 N개 미체크 todo를 SharedPreferences로 푸시, 위젯 표시) → B3.
- **잡/AI:** 없음. 순수 CRUD.

### 기능
빠른 작성·체크·삭제·정렬·마감일(선택). 위젯에서 쓰기/보기/체크.

### 장단점
- **장점:** 개념이 단순하고 결정 파이프라인과 격리 → **회귀 위험 최소**, 위젯 CRUD가 가장 가볍다. ADR-003과 충돌 없음(엔트리 없이도 자연스러움, 별도 축). 구현 속도 최快.
- **단점:** 의사결정·통계와의 **자동 연계가 없음**(수동 연결만). 데이터가 `decisions`/`todos` 두 갈래로 나뉘어, 통계 통합 시 별도 집계·조인이 필요. "결정의 후속 확인"과 "할 일"이 UX상 비슷해 **중복 인지** 우려.

### 확장 시 장단점
- **장점(+):** 나중에 `decision_id` nullable 컬럼만 추가(v9)하면 점진적 연결 가능. todo를 outcome 추적의 액션 아이템으로 승격하기 쉽다.
- **단점(−):** 통계/의사결정 분석을 본격화할수록 "두 모델을 합치는" 마이그레이션·리포팅 부채가 누적. 장기적으로 C로 수렴할 가능성이 큼(그럴 거면 처음부터 C가 유리).

---

## 4. 제안 B — 기존 `decisions`/follow-up 모델로 흡수 (강결합, 결정 중심)

### 개요
todo를 **별도 엔티티로 만들지 않고**, "사용자가 직접 추가한 가벼운 결정/액션"으로 본다. 위젯 TodoList = **due 후속 확인 + 사용자 추가 액션**을 한 리스트로 통합.

### 구현 방법
- **DB (마이그레이션 v8):** 순수 todo(엔트리 없는 항목)를 넣으려면 `decisions.entry_id`의 **NOT NULL 완화**가 필요(또는 todo마다 text Entry를 생성해 ADR-003 유지). 전자는 **ADR-003/스키마 개정**, 후자는 todo 1개당 Entry 1개가 생겨 데이터가 비대. 상태 축에 `'todo'`/`'done'` 또는 `kind` 컬럼 추가.
- **service/잡:** **미구현 `outcome_followup` 잡을 "후속 확인 todo 생성기"로 구현** — 결정이 due가 되면 todo(=확인 액션)가 자동 등장. 수동 todo는 경량 결정으로 insert.
- **UI:** Inbox는 단일 "할 일" 리스트로 통합(검토대기/후속/수동액션이 한 화면). deck은 신규 추출 컨펌 전용으로 축소.
- **위젯:** B2/B3로 due+todo를 함께 표시.

### 기능
"내 결정과 그 후속 액션이 곧 할 일"이라는 단일 모델. 카테고리·confidence·outcome·`decision_links`를 todo가 그대로 상속.

### 장단점
- **장점:** **의사결정 도움·통계가 가장 자연스럽게 통합**(모든 액션이 decision 그래프 안 → 카테고리별/결과별 집계 한 곳). `outcome_followup` 잡과 `decision_links`라는 **이미 깔린 인프라를 활용**.
- **단점:** **ADR-003과 정면 충돌**(엔트리 없는 todo). 우회(텍스트 엔트리 생성)는 비대·잡 큐(STT/라벨) 오발동 위험. 결정 추출 흐름과 todo CRUD가 한 테이블에 섞여 **복잡도·회귀 위험 최대**. 위젯 "즉시 쓰기"가 무거워짐(AI/잡 연계). 단순 todo UX와 모델 무게가 상충.

### 확장 시 장단점
- **장점(+):** 통계/분석 확장 시 추가 모델이 거의 불필요 — 결정-결과-링크가 이미 한 그래프. "이 결정이 저 todo를 낳았다"류 인사이트가 공짜에 가깝다.
- **단점(−):** 초기 ADR/스키마 개정 비용이 크고, 한 번 무거워진 모델은 되돌리기 어렵다. 단순 메모성 todo가 결정 통계를 오염시킬 수 있어 **필터링 규칙**이 계속 늘어난다.

---

## 5. 제안 C — 하이브리드: 독립 `todos` + 결정 연결 브리지 (권장)

### 개요
평소엔 A처럼 가볍고 독립적이되, **`decision_id`로 결정과 선택적으로 연결**한다. 통계는 별도 집계 레이어가 두 소스를 합산. "지금 단순, 나중에 연결"을 명시적 설계로 둔다.

### 구현 방법
- **DB (마이그레이션 v8):** `todos(... , source TEXT CHECK(source IN ('manual','decision')), decision_id TEXT NULL REFERENCES decisions(id), ...)`. soft delete, UTC ms, ULID. enum `TODO_SOURCE`를 `src/types/enums.ts`에 추가.
- **repo/store:** A와 동일(`todos.ts` + `stores/todos.ts`). 추가로 `listTodosByDecision`.
- **브리지(서비스):** 결정 **confirm 시 옵션** "액션 아이템으로 추가" → `source='decision', decision_id=…` todo 생성(중복 방지 키 = decision_id). 미구현 `outcome_followup` 잡을 **"due 결정 → 확인 todo 자동 생성"** 로 점진 구현(로드맵상 자연스러운 빈칸 채우기).
- **통계:** `src/db/repos/stats.ts`에 todo 집계 추가 — 독립 todo와 결정연계 todo를 분리/합산 모두 노출.
- **UI:** Inbox 토글 `deck` / `todo`. todo 항목이 결정과 연결돼 있으면 칩으로 표시(→ entry/decision 상세로 점프). 후속 확인은 "decision 소스 todo"로 자연 표현되거나 deck 상단 섹션 유지.
- **위젯:** B1→B2→B3 단계. 위젯 todo는 source 무관하게 한 리스트.

### 기능
A의 단순 CRUD + "결정→todo" 연결 + 통계에서 두 축 동시 분석. 위젯도 단계적.

### 장단점
- **장점:** 지금은 **A만큼 단순**(독립 테이블), 나중은 **B의 통합 인사이트**에 접근 가능. ADR-003 비충돌(todo는 별 축, 결정과는 link). 위젯·통계·연결을 **독립적으로 단계 출시** 가능. `decision_links`/`outcome_followup`라는 기존 빈칸과 의미가 맞물림.
- **단점:** **브리지 코드(동기화·중복 방지·소스 구분)** 추가. 두 모델의 정합성(예: 연결된 결정이 reject되면 todo는?)을 규칙으로 관리해야 함. A보다 초기 표면이 조금 넓다.

### 확장 시 장단점
- **장점(+):** 의사결정 도움(연관 분석)·통계화 모두를 **점진 마이그레이션 없이** 얹을 수 있는 가장 넓은 활주로. "todo 완료율 × 결정 카테고리 × outcome" 같은 교차 통계가 자연스럽다.
- **단점(−):** 설계 규율이 흐트러지면 A(완전 분리)와 B(완전 통합) 사이에서 **어중간**해질 수 있음 — 연결 규칙·SoT를 ADR로 못박아야 가치가 산다.

---

## 6. 비교 요약

| 기준 | A 독립 | B 결정 흡수 | C 하이브리드(권장) |
|------|--------|-------------|---------------------|
| 초기 구현 비용 | 낮음 | 높음(ADR/스키마 개정) | 중간 |
| ADR-003 충돌 | 없음 | 있음 | 없음 |
| 회귀 위험 | 낮음 | 높음 | 중간 |
| 위젯 단순성 | 최상 | 낮음(잡 연계) | 상 |
| 의사결정 도움 연계 | 약(수동) | 강(자동) | 중→강(점진) |
| 통계 확장성 | 분리 집계 부담 | 통합 최상 | 분리+합산 모두 가능 |
| 장기 수렴성 | C로 수렴 경향 | 되돌리기 어려움 | 목표 지점 |

---

## 7. 권장안 & 단계적 로드맵

**권장: 제안 C(하이브리드).** 위젯의 단순 UX(요구 1순위)를 A 수준으로 가져가면서, 결정·통계 확장(요구 2순위)의 활주로를 ADR-003 충돌 없이 확보한다. B의 통합 통계는 매력적이나 ADR-003 개정·회귀 비용이 현 단계 대비 과하다.

**로드맵(독립적으로 출시 가능):**
1. **Inbox 정리** — `list` 모드 제거, `deck`(컨펌)만 유지, 후속 확인 섹션 재배치. (소규모, 위 2절)
2. **`todos` v8 마이그레이션 + repo/store + Inbox todo 뷰.** 위젯은 **B1**(딥링크 빠른 추가)부터.
3. **위젯 B2**(SharedPreferences 스냅샷 읽기 표시).
4. **결정→todo 브리지**(confirm 시 액션 아이템 생성) + `stats`에 todo 집계.
5. **위젯 B3**(컬렉션+체크백) / **`outcome_followup` 잡을 todo 생성기로 구현** → 의사결정 도움·통계 교차 분석.

---

## 8. 공통 구현 체크리스트 (어느 안이든 준수)

- 신규 테이블/컬럼 = **마이그레이션 v8 추가 + `migrations.lock.json` 갱신**(기존 SQL 수정 금지, INV-migration-append).
- repo는 `makeRowMapper` 카탈로그, snake_case↔camelCase 변환은 repo 안에서, 모든 쿼리 `WHERE deleted_at IS NULL`.
- enum은 `src/types/enums.ts` 단일 진실원(Zod·CHECK 파생).
- 시각 UTC ms, ID ULID(`newId()`).
- UI는 `@/theme` 토큰만(하드코딩 금지), today/settings의 KAV·컴포저 패턴 재사용.
- 위젯 네이티브 변경은 **Config Plugin(`plugins/with-snackshot-widget.ts`)** 에 반영해야 `prebuild --clean` 후에도 복원됨. SharedPreferences 키·브로드캐스트 액션은 매니페스트 등록 필요.
- 완료 시 `npm run verify` 통과 + 에뮬레이터/위젯 시각 확인.
- ADR 영향: A/C는 **신규 ADR(예: "todo는 결정과 분리된 1급 엔티티, 선택적 link")** 추가 권장. B를 택하면 **ADR-003 개정**이 선행돼야 함.

---

## 9. 확정 설계 v1 — "의사결정 = Todo" (사용자 답변 반영)

> 아래 4개 갈림길에 대한 사용자 결정으로, 위 3제안 중 **B 계열(결정 자체를 todo로 확장)** 을 채택한다. 단 ADR-003 보존을 위해 **수동 결정도 Entry에 매단다**(별도 `todos` 테이블 없음). 7절 권장(C)을 대체한다.

**확정된 결정사항**
1. **추출 흐름: 둘 다 유지.** 일기 클립에서의 자동 발굴(extracted→Inbox 컨펌, 기존)과 **의도적 작성**(즉시 confirmed)을 병행한다.
2. **필수 구조: 4종 필수** — 상황(situation)·대안(alternatives)·이유(reasoning)·예상결과(expected_outcome). `situation` 필드를 신설한다(나머지 3종은 이미 존재).
3. **마무리: 2단계** — ① 수행 완료 체크(`executed_at`) → 활성 보드에서 제거, ② 결과·배운점은 **선택**(good/bad 간편 입력 또는 생략). 결과 입력만으로도 항목이 보드에서 제거될 수 있다.
4. **AI 채움 검토: 있음** — 키워드/음성으로 만들고 Gemini가 4필드를 채우면, **확인·수정 후 저장**(저장 시점에 confirmed).

### 9.1 입력 경로 (모두 유지/추가)
- **자동 발굴(기존):** 음성/영상 → Whisper → `extractDecisions` → `extracted` → Inbox deck 컨펌.
- **수동 텍스트(신규):** 4필드를 직접 작성 → 검토 불필요, 즉시 `confirmed`.
- **키워드 + Gemini 채움(신규):** 핵심어 몇 개 입력 → `composeDecision`(신규 라벨 모드)이 상황·대안·이유·예상결과 확장 → **검토·수정 후** `confirmed`.
- **음성/영상으로 작성(신규 의도형):** 녹음/녹화 → Whisper → `composeDecision`로 4필드 구성 → 검토·수정 후 `confirmed`. (자동 발굴과 달리 "이건 결정이다"라고 사용자가 의도)

### 9.2 데이터 모델 변경 — 마이그레이션 v8 (전부 additive)
`decisions` 테이블에 컬럼 추가(ALTER TABLE ADD COLUMN — append-only 안전):
- `situation TEXT` — AI/작성 원본 상황(맥락). (ADR-016 원본 축)
- `user_situation TEXT` — 사용자 편집본 상황. (ADR-016 편집 축)
- `executed_at INTEGER` — 수행 완료 시각(null = 활성 todo). status와 **직교**.
- `origin TEXT CHECK(origin IN ('ai_extracted','authored'))` — 출처 구분(기본 'ai_extracted'). 작성분 = 'authored'.

추가 안 함(재사용): `expected_outcome`(이미 존재 — 작성 경로에서 **필수**로 검증), `outcomes` 테이블(결과·배운점 그대로), `decision_links`(연관 분석).

enum: `src/types/enums.ts`에 `DECISION_ORIGIN` 추가. status enum(extracted/confirmed/rejected/edited)은 **불변**(executed는 컬럼으로 표현, CHECK 재작성 불필요).

쿼리 변경(마이그레이션 아님): 보드/후속 조회에 `executed_at IS NULL` 조건 추가. `getDecisionsDueForFollowUp`도 `executed_at IS NULL` 추가.

### 9.3 라이프사이클 / 상태 (마무리 = "모두 제공, 단순하게")

- **활성(보드의 todo):** `status IN ('confirmed','edited') AND executed_at IS NULL AND deleted_at IS NULL`. (작성분은 생성 즉시 confirmed → 바로 활성)

- **완료 경로 — 두 가지를 모두 제공:**
  1. **단순 체크(수행 완료):** 체크 → `executed_at` 기록 → 활성 보드에서 빠짐. 체크 직후 "good/bad나 메모 남길까?"를 **가볍게 물어보되 생략 가능**. 생략하면 결과(outcome) 없이 실행 사실만 남는다.
  2. **good/bad 원탭 확정:** 보드 항목에서 good 또는 bad를 바로 탭 → `executed_at` + `outcomes`(result만) 동시 기록 → **추가 작성 불필요**, 즉시 종료.
  - (선택) 더 풍부한 회고: 상세에서 `reflection`/`learnings`까지 입력 가능. 항상 선택.

- **회고 대기(7일 윈도우):** 단순 체크로 완료했지만 **outcome이 아직 없는** 항목은 `executed_at` 이후 **7일간 별도 "회고 대기" 영역**에 노출 → 그 동안 **언제든** good/bad·메모를 추가할 수 있다. 추가하면 종료. 추가 데이터 컬럼 불필요 — 윈도우는 `executed_at + 7일`에서 파생한다.
  - 조회식: `executed_at IS NOT NULL AND executed_at >= now-7d AND` (해당 결정에 outcome 없음).
  - **7일 경과:** 회고 대기 목록에서 자연히 빠짐(결과 없이 종료 처리). 단 결정 상세/이력에서는 계속 열람·메모 가능. *(가정 — 7일 후 자동 마감 동작, 다르게 원하면 조정)*

- 자동 발굴분만 여전히 `extracted` 단계를 거쳐 Inbox deck에서 컨펌.

### 9.4 화면/플로우
- **결정 보드(신규, Inbox 리스트 모드 자리 대체):** 두 섹션.
  - *활성:* 결정 todo 목록(상황 요약·카테고리). 각 항목에 **체크박스(수행완료)** + **good/bad 원탭 버튼**. 체크→완료(옵션 회고 프롬프트), good/bad→즉시 확정. 카테고리/마감(follow_up) 필터.
  - *회고 대기(7일):* 체크만 하고 결과 미입력 항목. 언제든 good/bad·메모 추가. 7일 후 자동으로 목록에서 빠짐.
- **결정 작성 화면(신규 또는 compose-text 확장):** 상황·대안·이유·예상결과 4칸 + 카테고리. "Gemini로 채우기"(키워드만 입력) → 채움 결과 검토·수정 → 저장(confirmed). 음성/영상 의도형 입력도 이 검토 화면으로 합류.
- **Inbox:** deck(자동 발굴 컨펌)만 유지. 컨펌하면 보드로 흘러감. 리스트 모드/ViewToggle 제거.
- **entry/[id]:** 기존 결정 표시에 `situation` 추가.

### 9.5 라벨 서비스 변경
- `extractDecisions(transcript)`(기존): 프롬프트·응답 스키마에 **`situation` 추가**(자동 발굴분도 상황을 채우도록).
- `composeDecision(input)`(신규): 희소 키워드/짧은 전사를 **단일 결정의 4필드로 확장**하는 별도 프롬프트. 반환은 검토용 1건.

### 9.6 통계/확장 여지 (이후)
수행 완료율(executed/confirmed), 카테고리별 분포, good/bad 비율, follow-up 준수율, `decision_links` 기반 연관. 위젯은 보드 상위 N개를 B1→B2→B3로 노출(2절).

### 9.7 ADR 영향 (구현 전 갱신 필요)
- **ADR-006 개정:** 결정 출처에 "의도적 작성(즉시 confirmed)" 추가, 컨펌 게이트는 자동 발굴분에만 적용.
- **ADR-016 확장:** `situation`/`user_situation` 원본·편집 분리 축 추가.
- **ADR-017 개정/신규:** 후속 확인 → "수행 완료(executed) + 선택적 결과" 2단계 라이프사이클, 결정 보드 신설.
- **신규 ADR:** "결정의 4필수 구성(상황·대안·이유·예상결과)" 명문화.

### 9.8 단계적 구현 로드맵
1. ✅ **(구현됨)** v8 마이그레이션 (situation/user_situation/executed_at/origin) + 타입/enum/Zod/`makeRowMapper`/`migrations.lock` + `extractDecisions` 프롬프트에 situation 반영.
2. ✅ **(구현됨)** 결정 보드 (Inbox `list`→`board` 모드 대체): 진행 중 todo(`getActiveUpcomingDecisions`) + 수행 완료 체크(`markDecisionExecuted`/`markExecuted`) + 후속 확인 섹션 유지. `DecisionBoardCard` 신설, 구 `DecisionCard` 제거. due 쿼리에 `executed_at IS NULL` 반영.
3. ✅ **(구현됨)** 수동/키워드 작성 화면(`app/compose-decision.tsx`) + `composeDecision` Gemini 모드(키워드→4필드 확장) + 검토·수정 후 저장. `saveAuthoredDecision`(text 엔트리 + confirmed/authored 결정 + 옵시디언). Inbox 헤더 '+결정' 진입점.
4. ✅ **(구현됨)** 마무리 2단계: 보드 항목에 수행 완료 체크(→회고 대기) + good/bad 원탭(즉시 종료). 회고 대기(7일 윈도우, `getPendingReflectionDecisions`) 섹션 신설. `markDecisionExecuted` 멱등화, `recordOutcome`가 executed 멱등+3목록 통합 처리. `FollowUpCard` 캡션 상황별 분기(수행 완료/예정).
   - ✅ **(4.1 후속)** 체크해도 사라지지 않고 **압축 체크행(`DecisionDoneRow`)** 으로 잔존 → 체크 취소(`unmarkDecisionExecuted`/`unmarkExecuted`)·결과 기록 가능. 회고를 영상뿐 아니라 **텍스트로 바로 입력** — 모달 대신 **인라인 확장 편집기(`OutcomeEditor`)** 가 결정 카드 아래에서 펼쳐짐(`recordOutcome` reflection 인자, 보드 KAV). 
   - ✅ **(4.1 후속)** Today 탭: 텍스트 엔트리를 **'의사결정'(확정 결정 보유) / '메모'로 구분 표기**(`getPrimaryDecisionForEntry`). 메모 탭→**인라인 편집**(`updateManualNote`), 의사결정 탭→**수정 시트**(`EditDecisionSheet`). EntryDiaryItem/EntryCard에 `decision` prop, 텍스트 카드 탭 가능화.
   - ✅ **(4.1 후속)** **의사결정 모아보기 화면**(`app/decisions.tsx`)을 관리형으로: 탭→인라인 상세 확장(상황·대안·이유·예상결과·결과), 상태 배지·필터(전체/진행중/완료/반려), **편집**(`EditDecisionSheet`에 상황 추가, `updateUserEdit`에 user_situation) + **Todo로 되돌리기**(`revertDecisionToTodo`: outcome 삭제+executed 해제+반려→confirmed). `getAllDecisions`에 rejected 포함. Archive 헤더 진입 버튼.
5. **통계 + 위젯**(보드 상위 N개).

> 각 단계는 독립 출시 가능하며, 1→2만으로도 "confirm 이후 결정을 모아 보고 체크"라는 핵심 결핍이 해소된다.
