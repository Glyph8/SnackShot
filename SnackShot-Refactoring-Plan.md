# SnackShot 리팩토링 계획 — AI 주도 개발(풀 바이브 코딩) 최적화

작성일: 2026-06-16
대상 독자: **이 코드를 수정할 AI 에이전트** (사람은 부차적)
실행 도구: 각 항목은 `feature-dev` 스킬 → planner/db/service/ui/qa 에이전트로 처리 가능하도록 분해함

---

## 0. 설계 철학: "사람이 읽기 쉬움"이 아니라 "AI가 틀리지 않음"

이 코드베이스는 이미 품질이 높다. `any` 0건, `.then()` 0건, `expo-av` 0건, ADR 규율이 엄격하고 마이그레이션 주석이 모범적이다. 따라서 리팩토링의 목표는 "정리"가 아니라 **AI가 코드를 수정할 때 실수할 확률을 구조적으로 낮추는 것**이다. AI 주도 개발에서 버그는 대부분 다음 세 곳에서 발생한다.

1. **수작업 동기화 지점(hand-sync points)** — 한 개념이 여러 파일에 흩어져, 하나를 고치면 나머지도 같이 고쳐야 하는 곳. AI는 한 군데를 빠뜨린다.
2. **드리프트된 문서** — 에이전트는 코드보다 문서를 먼저 신뢰한다. 문서가 거짓말을 하면 에이전트가 거짓을 전제로 코딩한다.
3. **컨텍스트 비용** — 큰 파일·중복·미인덱싱 문서는 에이전트가 매번 비싸게 읽어야 하고, 읽다가 토큰이 부족해 핵심을 놓친다.

아래 계획은 이 세 가지를 줄이는 순서로 우선순위를 매겼다. **각 항목은 독립 실행 가능**하며, 의존성이 있으면 명시했다.

### 우선순위 요약

| # | 작업 | 분류 | 효과 | 비용 | 위험 |
|---|------|------|------|------|------|
| P0-1 | 죽은 코드·고아 파일 제거 | 드리프트 | 높음 | 낮음 | 낮음 |
| P0-2 | 루트 분석 문서 정리·인덱싱 | 컨텍스트 | 높음 | 낮음 | 없음 |
| P0-3 | 하네스 문서 드리프트 수정 | 드리프트 | 매우 높음 | 낮음 | 낮음 |
| P1-1 | 기계가독 INVARIANTS.md 신설 | 드리프트 | 매우 높음 | 중간 | 낮음 |
| P1-2 | 도메인 enum 단일 진실원화 | 수작업동기화 | 매우 높음 | 중간 | 중간 |
| P1-3 | schema.ts 트리거/테이블 SQL 상수 추출 | 컨텍스트 | 높음 | 중간 | 중간 |
| P2-1 | repo row↔도메인 매핑 표준화 | 수작업동기화 | 매우 높음 | 높음 | 중간 |
| P2-2 | ADR 불변식의 컴파일 타임/린트 강제 | 수작업동기화 | 높음 | 높음 | 중간 |
| P3-1 | 대형 UI 화면 분할 | 컨텍스트 | 중간 | 중간 | 낮음 |
| P3-2 | 화면별 `__codemap__` 헤더 주석 | 컨텍스트 | 중간 | 낮음 | 없음 |

---

## P0 — 즉시 처리 (저비용·고효과, 의존성 없음)

### P0-1. 죽은 코드·고아 파일 제거

AI 에이전트는 존재하는 파일을 "의미 있는 것"으로 간주한다. 죽은 코드는 잘못된 패턴을 학습시킨다.

- **`src/services/stt/WhisperSttService.ts` 삭제.**
  - 이 파일은 `class WhisperSttService implements SttService { ... throw new Error('not implemented') }`로, **CLAUDE.md의 "클래스/DI 금지" 규칙을 정면 위반하는 죽은 stub**이다.
  - 실제 구현은 `whisper.ts`의 함수형 객체 `whisperSttService`이고, 팩토리(`stt/index.ts`)도 이쪽만 참조한다. 이 클래스는 어디서도 import되지 않는다. (참고: `jobs/handlers.ts`의 `RescheduleError`/`CancelJobError`는 `Error` 서브클래스로 정당한 예외이며 제거 대상이 아니다 — 죽은 비즈니스 클래스는 이 파일 하나뿐이다.)
  - 위험: 에이전트가 새 서비스를 만들 때 이 파일을 "참고 예시"로 삼으면 클래스 패턴을 복제한다. 즉시 삭제.
  - 검증: `grep -rn 'WhisperSttService' src app` → 0건이어야 함. `npx tsc --noEmit` 통과.

- **`AGENTS.md` 처리 결정.**
  - CLAUDE.md 변경 이력은 "AGENTS.md 고아화 해소(지침 흡수)"라고 적었지만 **파일은 아직 루트에 남아 있다.** 내용은 "Expo 버전 문서 확인" 1줄로 이미 CLAUDE.md에 포함됨.
  - 조치: 삭제하거나, 일부 코딩 에이전트 생태계가 `AGENTS.md`를 자동 로드한다는 점을 살리려면 **CLAUDE.md를 가리키는 1줄 포인터**로 축소(`# 이 저장소의 규칙은 CLAUDE.md를 따른다`). 둘 중 하나로 통일해 "둘 다 진실원"인 상태를 끝낸다.

### P0-2. 루트 분석 문서 정리·인덱싱

현재 루트에 조사/계획 성격의 `.md`가 인덱스 없이 흩어져 있다:
`SnackShot-Phase6-Prompts.md`, `SnackShot-reorder-analysis.md`, `SnackShot-vad-analysis.md`, `SnackShot-tiered-compression-analysis.md`.

문제: 에이전트가 루트를 훑을 때 이들을 ADR/디자인시스템과 동급의 "권위 있는 사양"으로 오해할 수 있다. 실제로는 "구현 X" 단계의 탐색 메모다.

- `docs/explorations/` 디렉토리로 이동하고, 각 파일 상단에 상태 배지를 강제한다: `> 상태: 탐색(미구현) | 날짜 | 관련 ADR: 없음`.
- 루트에 `docs/INDEX.md`를 만들어 **모든 문서의 권위 등급을 한 표로** 명시한다:

  | 문서 | 등급 | AI가 따라야 하나? |
  |------|------|------------------|
  | CLAUDE.md | 규범(canonical) | 항상 |
  | SnackShot-ADR*.md | 규범 | 항상 |
  | SnackShot-DesignSystem.md | 규범 | UI 작업 시 |
  | INVARIANTS.md (P1-1 신설) | 규범·기계가독 | 항상 |
  | docs/explorations/* | 참고(비규범) | 아니오, 맥락용 |

- `_workspace_prev/`, `_workspace_prev2/` 삭제(또는 `.gitignore`로 트리에서 제거). 과거 핸드오프 산출물이라 에이전트 컨텍스트만 잡아먹는다. `_workspace/`는 이미 gitignore 대상이지만 `_prev*`는 여전히 트리에 노출된다.

### P0-3. 하네스 문서 드리프트 수정 (가장 중요한 P0)

`.claude/agents/*.md`의 "도메인 지식"과 "구조 스냅샷"이 실제 코드보다 뒤처져 있다. 에이전트는 이걸 먼저 읽으므로 드리프트가 곧 버그다.

확인된 드리프트:

- **planner.md** — `AiJobType` 목록에 `obsidian_export` 누락(코드엔 5종). Entry 설명에 `sttStatus`(v4 신설) 누락. `EntryMode`를 voice/silent로만 암시하나 실제 4종(voice/silent/audio/text).
- **db-engineer.md** — `toEntry` 예시가 구형. 실제엔 `thumbnailPath`, `manualNote`, `sttStatus`, `exportedAt`가 더 있다. 예시 코드가 실제와 다르면 에이전트가 컬럼을 빠뜨린다.
- **service-engineer.md** — "서비스 구조 스냅샷(2026-06-11)"에 `stt/`, `jobs/`만 있으나 실제로는 `label/`, `obsidian/`, `deleteEntry.ts`가 더 있다.
- **ui-engineer.md** — 라우트 맵에 `compose-text.tsx` 누락.

조치(둘 중 택1, 권장은 B):

- **A안(임시):** 각 문서를 현행화. 단, 또 드리프트할 운명.
- **B안(권장, 근본):** 에이전트 문서에서 **"스냅샷" 섹션을 전부 삭제**하고, "작업 전 반드시 `docs/INDEX.md`와 `INVARIANTS.md`(P1-1), 그리고 해당 디렉토리의 실제 파일을 읽어라"는 **단일 지시로 대체**한다. 스냅샷은 구조적으로 드리프트하므로, 유지보수 부담이 없는 "코드를 진실원으로 읽어라" 지시가 AI 주도 개발에 더 강건하다. 도메인 enum·불변식 같은 진짜 진실원은 P1-1의 기계가독 파일로 일원화한다.

---

## P1 — 단일 진실원 확립 (드리프트·수작업동기화의 뿌리)

### P1-1. `INVARIANTS.md` 신설 — ADR을 기계가독 규칙표로 증류

현재 ADR은 43KB 서사(Situation/Task/Action/Result)다. 에이전트가 필요로 하는 건 **불변식(invariant) 그 자체**인데, 매 작업마다 서사 전체를 읽어야 규칙을 추출할 수 있다. 컨텍스트 낭비이자 누락 위험.

- 루트에 `INVARIANTS.md`를 만들어 **강제 가능한 규칙만** 한 줄씩, 검증 명령과 함께 표로 적는다. 서사는 ADR에 그대로 두고 번호로 링크.

  | ID | 불변식 | 적용 범위 | 위반 탐지 명령 |
  |----|--------|-----------|----------------|
  | INV-soft-delete | 모든 entries/decisions/outcomes 쿼리에 `deleted_at IS NULL` | src/db/repos | `grep -A2 'FROM entries' …` |
  | INV-utc-ms | 시각은 INTEGER ms, 표시 시에만 변환 | 전체 | 코드리뷰 |
  | INV-id-ulid | ID는 `newId()` | 전체 | `grep 'uuid\|Math.random'` |
  | INV-ai-original | AI 원본 컬럼과 user* 편집본 컬럼 분리 | decisions/outcomes | 스키마 검사 |
  | INV-no-class | repo/service는 함수형, 클래스 금지(단 `Error` 서브클래스는 허용) | src | `grep -n 'class ' \| grep -v 'extends Error'` |
  | INV-no-expo-av | expo-video/expo-audio만 | 전체 | `grep 'expo-av'` |
  | INV-token-only | 색·간격·폰트는 @/theme 토큰 | app, components | `grep '#[0-9a-fA-F]\{6\}'` |
  | … | … | … | … |

- **이 표는 qa-engineer.md의 grep 검사 목록과 1:1 대응**시킨다. 즉 "규칙 정의(INVARIANTS.md)"와 "규칙 검사(qa-engineer)"가 같은 진실원을 공유 → 한쪽만 바뀌어 어긋나는 일을 없앤다.
- 기대 효과: 에이전트가 ADR 43KB 대신 INVARIANTS.md 한 장으로 규칙을 로드. 토큰↓, 누락↓.

### P1-2. 상태/카테고리 enum 단일 진실원화

`ProcessingStatus`(pending/processing/done/failed/skipped), `DecisionCategory`, `OutcomeResult`, `EntryMode` 등은 현재 **세 곳에 손으로 중복** 정의돼 있다: ① `src/db/schema.ts`의 SQL `CHECK` 제약, ② `src/types/domain.ts`의 TS 유니온, ③ (해당 시) Zod 스키마. 컬럼 값 하나 추가하려면 세 곳을 동시에 고쳐야 하고 — 실제로 v3(audio)·v7(text) 마이그레이션이 그 증거다 — AI는 이런 다중 동기화에서 한 곳을 빠뜨린다.

- `src/types/enums.ts`(또는 domain.ts 내 상단)에 **배열 상수를 진실원으로** 둔다:
  ```ts
  export const PROCESSING_STATUS = ['pending','processing','done','failed','skipped'] as const;
  export type ProcessingStatus = typeof PROCESSING_STATUS[number];
  export const ENTRY_MODE = ['voice','silent','audio','text'] as const;
  export type EntryMode = typeof ENTRY_MODE[number];
  // …category, outcomeResult, decisionStatus, aiJobType…
  ```
- 이 배열로부터 **Zod enum과 CHECK 제약 문자열을 파생**시킨다:
  ```ts
  export const sqlCheck = (col: string, vals: readonly string[]) =>
    `CHECK (${col} IN (${vals.map(v => `'${v}'`).join(',')}))`;
  ```
  - 단, **기존 마이그레이션 SQL은 append-only라 수정 금지**(러너 설계 원칙). 따라서 이 파생은 **신규(v8+) 마이그레이션과 Zod에만 적용**하고, 과거 마이그레이션은 그대로 둔다. 목표는 "앞으로 enum을 한 곳에서만 고치게" 하는 것.
- 부수효과: `as EntryMode` 같은 단언이 배열 기반 타입가드(`isEntryMode(x)`)로 대체 가능 → repo의 `to*()` 변환이 더 안전.
- 위험: 중간. 타입은 100% 호환되게 설계하되, 빌드 후 `npx tsc --noEmit`로 회귀 확인 필수.

### P1-3. `schema.ts`의 트리거·테이블 SQL 중복 제거

`schema.ts`(621줄)는 FTS 트리거 5종 본문이 **v2·v3·v7에 걸쳐 3회 글자 그대로 반복**되고, `CREATE TABLE entries`도 3회 반복된다. 에이전트가 스키마를 읽을 때 이 반복이 컨텍스트의 큰 부분을 차지한다.

- 트리거/공통 SQL 조각을 **명명된 const 문자열**로 추출:
  ```ts
  const FTS_TRIGGER_TRANSCRIPTS_INSERT = `CREATE TRIGGER fts_transcripts_insert …`;
  ```
  그리고 마이그레이션 배열에서 해당 const를 참조한다.
  - **핵심 제약:** SQLite에 저장되는 최종 SQL 텍스트는 **한 글자도 바뀌면 안 된다**(이미 배포된 DB의 user_version 이력과 일치해야 함). const 추출은 "같은 문자열을 변수로 가리키는" 순수 리팩토링이어야 하며, 추출 후 **추출 전/후 SQL 문자열이 완전히 동일한지 스냅샷 테스트**로 못박는다.
  - 안전한 검증: 리팩토링 전 `MIGRATIONS`를 JSON으로 덤프 → 리팩토링 후 다시 덤프 → `diff`가 비어야 통과. (간단한 node 스크립트로 가능, qa 단계에 추가)
- 기대: schema.ts 길이·중복 대폭 감소, 향후 트리거 의도 파악이 1곳에서 끝남. 위험은 중간이며 스냅샷 테스트로 통제한다.

---

## P2 — 수작업 동기화 지점 제거 (가장 큰 버그 원천)

### P2-1. repo의 row↔도메인 매핑 표준화 (최대 효과 항목)

현재 컬럼 하나를 추가하려면 한 엔티티에 대해 **최대 7곳을 손으로 동기화**해야 한다: ① schema CHECK/CREATE, ② 신규 마이그레이션, ③ repo의 `Row` 인터페이스, ④ `to*()` 매퍼, ⑤ `domain.ts` 타입, ⑥ INSERT/UPDATE 컬럼 목록, ⑦ (있으면) Zod. `entries.ts`의 `EntryRow`/`toEntry`가 전형이다. **이것이 이 코드베이스에서 AI가 가장 실수하기 쉬운 표면이다.**

세 가지 옵션(보수→공격 순):

- **옵션 A (저위험, 권장 시작점): 컬럼 매핑을 데이터로 선언.**
  엔티티별로 `[snakeCol, camelKey, kind]` 매핑 테이블을 한 번 선언하고, 공용 `rowToDomain(map, row)` / `domainToInsert(map, obj)` 헬퍼가 변환·NULL→undefined·boolean(0/1)을 일괄 처리. 각 repo는 매핑 한 표만 유지 → 동기화 지점이 7곳에서 1~2곳으로 축소.
- **옵션 B (중위험): `src/db/columns.ts`에 엔티티별 컬럼 카탈로그를 단일 정의**하고, Row 타입·INSERT 컬럼·매퍼를 여기서 파생. P1-2 enum 진실원과 결합하면 "스키마 모양"이 한 파일에 모인다.
- **옵션 C (고위험, 비권장): Drizzle 등 타입세이프 ORM 도입.** 효과는 크나 expo-sqlite 커스텀 마이그레이션 러너·FTS 트리거·append-only 정책과 충돌이 커서 본 프로젝트엔 과投資.

권장 경로: **A → (안정화 후) B**. C는 보류.
검증: 각 repo 리팩토링 후 `tsc --noEmit` + 콘솔 로그로 실제 read/write 라운드트립 1회 확인(CLAUDE.md 작업 흐름 2번).

### P2-2. ADR 불변식을 grep이 아니라 타입/런타임으로 강제

현재 불변식 위반은 **qa-engineer의 사후 grep**으로만 잡힌다. grep은 오탐이 잦고(이미 CLAUDE.md 이력에 "가짜 FAIL" 패치 기록 있음), 사후 검출이라 에이전트가 이미 틀린 코드를 쓴 뒤다. 가능한 것은 **작성 시점에 막는 쪽**으로 옮긴다.

- **soft-delete:** repo 내부에 `selectActive(table, where?)`처럼 `deleted_at IS NULL`을 항상 붙이는 쿼리 빌더 헬퍼를 두고, 자유 문자열 SQL 대신 이를 쓰도록 유도. 누락이 구조적으로 어려워짐.
- **시각 타입:** `recordedAt: number`를 브랜디드 타입 `UtcMs = number & { __utcMs: true }`로 만들면 "로컬 시각 number"를 잘못 대입할 때 컴파일 에러. (선택적, 비용 대비 효과 중간.)
- **토큰 강제:** ESLint + `eslint-plugin-react-native`의 색상 리터럴 룰 또는 커스텀 룰로 `#RRGGBB`·매직넘버를 **CI에서 차단**. 현재 `.github/`에 CI가 있으니 거기에 `tsc --noEmit` + lint 게이트를 추가.
- 이 항목은 qa-engineer.md grep 목록을 **줄이는** 방향(컴파일/린트가 잡는 건 grep에서 제거)으로 동기화한다.

---

## P3 — 컨텍스트 비용 절감 (큰 파일·탐색성)

### P3-1. 200줄 규칙 위반 대형 화면 분할

CLAUDE.md는 "한 파일 200줄 이내 권장"이라 명시하나 실제 초과 파일이 다수다(읽기 비용 = 매 수정마다 토큰):

| 파일 | 줄 | 분할 제안 |
|------|----|-----------|
| `app/(tabs)/archive.tsx` | 680 | `CalendarDay`/`WeekStrip`/`PhotoStack`는 이미 파일 내 함수 → `src/components/archive/`로 추출. 화면은 조합만 남김 |
| `app/(tabs)/settings.tsx` | 529 | 섹션별(키 관리/모델 선택/옵시디언/통계) 컴포넌트 분리 |
| `app/entry/[id].tsx` | 412 | 헤더/본문/결정 섹션/액션 분리 |
| `app/(tabs)/today.tsx` | 404 | 리스트 모드·수정 모드 컴포넌트 분리 |
| `src/services/obsidian/export.ts` | 313 | 노트 렌더링과 파일 I/O 분리 |
| `src/services/jobs/handlers.ts` | 304 | 잡 타입별 핸들러 파일 분리(compression/stt/label/outcome/export) |

- 분할 시 **추출된 컴포넌트는 무상태 프레젠테이션 우선**, 데이터는 store/props로. ui-engineer의 기존 규칙과 일치.
- 위험 낮음(순수 이동). 단 한 번에 한 화면씩(P0-3의 "한 파일씩 단순하게" 원칙). schema.ts(621)는 P1-3에서 별도로 줄어듦.

### P3-2. 파일 상단 `__codemap__` 헤더로 탐색성 부여

AI 에이전트는 파일을 열기 전에 "이 파일이 무엇이고 무엇과 연결되는지"를 알면 불필요한 읽기를 줄인다.

- 각 화면/서비스/repo 상단에 표준화된 한 블록 주석을 단다:
  ```ts
  /** @codemap
   *  역할: Entry 상세 화면
   *  읽기: getEntry, getDecisionsByEntry (@/db)
   *  쓰기: updateEntryNote → label_extraction 잡 큐잉 (@/services)
   *  관련 ADR: 003, 006, 016
   *  관련 화면: today, inbox
   */
  ```
- 기대: 에이전트가 그랩 없이 의존성·ADR 맥락을 즉시 파악. 사람에겐 약간 장황하지만 **AI 주도 개발에 맞춘 트레이드오프**(사용자 요구사항과 정확히 일치).
- 선택적으로 루트 `docs/CODEMAP.md`에 "엔티티 → 이를 만지는 repo/service/화면" 역색인 표를 두면 planner 에이전트가 영향 범위 산정을 더 정확히 한다.

---

## 실행 순서 권고

1. **P0 전체** 먼저(반나절, 위험 거의 없음, 즉시 드리프트 차단).
2. **P1-1 INVARIANTS.md** → 이후 모든 작업의 기준점이 되므로 P1에서 가장 먼저.
3. **P1-2 enum 진실원** → **P2-1 옵션 A**(둘이 결합될 때 효과 최대). 각 엔티티 단위로 쪼개 실행.
4. **P1-3 schema 상수 추출**(스냅샷 테스트 동반).
5. **P2-2**(CI 게이트부터, 나머지는 점진).
6. **P3**는 위 안정화 후 화면 단위로 천천히.

각 단계는 `feature-dev` 스킬로 돌리되, **이번 리팩토링을 계기로 P0-3(B안)·P1-1을 먼저 반영하면 이후 에이전트들이 더 정확한 진실원을 읽고 작업**하게 된다 — 즉 하네스 자체를 먼저 고치는 것이 복리 효과가 가장 크다.

## 명시적 비목표 (하지 말 것)

- ADR 결정 임의 변경(질문 후 ADR 갱신 원칙 유지).
- 과거 마이그레이션 SQL 텍스트 수정(append-only).
- ORM 전면 도입(P2-1 옵션 C) — 현 단계 과투자.
- 테스트 프레임워크 대규모 도입 — 본인 사용 도구 특성상 `tsc + 스냅샷 + 에뮬레이터 확인`의 현 루프가 비용 대비 적정. 단 P1-3/P2-1의 회귀를 막을 **최소 스냅샷 스크립트**는 추가 가치가 있다.
