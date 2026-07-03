# 의사결정 기능 강화 — 구현 가이드 (D1~D4)

> 등급: 구현 지시서(승인된 설계). `docs/INDEX.md` 등재.
> 작성: 2026-07-03, 사전 분석 세션. 실행자: AI 에이전트 + 하네스(feature-dev).
> **이 문서의 설계 결정은 검토·확정된 것이다. 재설계하지 말고 그대로 구현하라.**
> 코드와 충돌하는 서술만 코드를 우선하되, 충돌 내용을 완료 보고에 남겨라.
> 배경 분석(왜 이 항목들인가)은 2026-07-03 평가 세션 요약이 CLAUDE.md 변경 이력에 있다.

## 0. 공통 규칙 — 모든 phase 시작 전 숙지

- 규범: `CLAUDE.md` > `INVARIANTS.md` > `docs/INDEX.md` 권위표. 문서-코드 충돌 시 코드가 이긴다.
- 코드 변경은 **feature-dev 스킬 경유**(CLAUDE.md 하네스 트리거).
- 완료 게이트: `npm run verify` PASS + 해당 phase 수용 기준 전부 통과. 하나라도 실패면 미완료.
- 마이그레이션은 **append-only**: 새 버전 추가 + `TARGET_VERSION` 증가 → `node scripts/check-migrations.mjs --update`로 lock 갱신. 기존 버전 SQL 텍스트 수정 절대 금지(해시 락이 차단한다).
- **Expo SDK 55는 학습 데이터보다 최신이다.** 네이티브 모듈(특히 D3의 expo-notifications) 사용 전 반드시 https://docs.expo.dev/versions/v55.0.0/ 를 확인하라. 구 API는 런타임에서 throw할 수 있다.

### DB 동작 검증 레시피 (v14에서 실증된 방법)

마이그레이션·트리거 변경은 다음으로 검증한다(에뮬레이터 불필요):

```bash
npx tsc src/db/schema.ts --outDir /tmp/migout --module commonjs --target es2019 \
  --rootDir src/db --skipLibCheck
node -e "const {MIGRATIONS,TARGET_VERSION}=require('/tmp/migout/schema.js');
  const a=[];for(let v=1;v<=TARGET_VERSION;v++)for(const s of MIGRATIONS[v])a.push(s);
  require('fs').writeFileSync('/tmp/all.sql',JSON.stringify(a));"
# python3 sqlite3 인메모리로 /tmp/all.sql 전체 실행 후 수용 기준 시나리오 실행
```

### 함정 목록 (실제로 밟은 것들)

1. **FTS 트리거 × 테이블 재생성**: entries/decisions를 참조하는 트리거가 있는 테이블을
   재생성(CHECK 변경 등)할 때는 트리거 선제 DROP + 후행 재생성 필수. `schema.ts` v3/v7
   주석 참조. **D1의 decisions_fts 트리거도 이후 decisions 재생성 시 이 목록에 들어간다**
   — 트리거 상수 옆에 경고 주석을 남겨라(v14 `FTS_ENTRIES_INSERT_NOTE` 선례).
2. **unicode61 한국어 한계**: 조사가 붙은 어절은 정확 매치가 안 된다. 질의는 반드시
   `buildFtsQuery`(현 위치 `src/db/repos/transcripts.ts`) 방식 — 토큰별 `*` prefix.
3. 시각은 `nowMs()`(`@/lib/time`), 표시 변환만 date-fns (ADR-013).
4. 색·간격·폰트는 `@/theme` 토큰만. `palette` 직접 import 금지.
5. 한 파일 200줄 권장 — 새 UI 블록은 `src/components/` 하위 폴더로 분리.
6. AI 응답은 Zod `safeParse`(ADR-021). 도메인 enum 추가는 `src/types/enums.ts` 먼저(INV-enum-source).

---

## D1. 결정 전문검색 — v15 `decisions_fts` (우선순위 1)

### 설계 (확정)

**v15 마이그레이션** (`src/db/schema.ts`):

1. `CREATE VIRTUAL TABLE decisions_fts USING fts5(decision_id UNINDEXED, text, tokenize = 'unicode61')`
2. backfill: `deleted_at IS NULL`인 기존 결정 전부.
3. 트리거 3개(상수 추출, v2 FTS 트리거군 선례):
   - `fts_decisions_insert` — AFTER INSERT ON decisions
   - `fts_decisions_update` — AFTER UPDATE OF summary, user_summary, situation, user_situation, reasoning, user_reasoning, custom_category ON decisions (DELETE 후 재INSERT 패턴, `fts_entries_update_note` 선례)
   - `fts_decisions_soft_delete` — AFTER UPDATE OF deleted_at … WHEN NEW.deleted_at IS NOT NULL → 행 제거

**인덱싱 텍스트 (확정)**:

```sql
COALESCE(NEW.user_summary, NEW.summary)
  || ' ' || COALESCE(NEW.user_situation, NEW.situation, '')
  || ' ' || COALESCE(NEW.user_reasoning, NEW.reasoning, '')
  || ' ' || COALESCE(NEW.custom_category, '')
```

- rejected 포함 전부 인덱싱한다. 상태 필터는 질의 시 JOIN으로(FTS 행 수가 작아 단순성 우선).

**repo** (`src/db/repos/decisions.ts`):

- `searchDecisions(db, query, limit = 30, filters?)` 신설. 반환 `{ decision: Decision; snippet: string }[]`.
- 쿼리는 `searchTranscripts` 미러: `FROM decisions_fts JOIN decisions d ON d.id = decision_id WHERE decisions_fts MATCH ? AND d.deleted_at IS NULL`, `snippet(decisions_fts, 1, '<m>', '</m>', ' … ', 20)`, `ORDER BY d.extracted_at DESC`, FTS 파싱 오류는 try/catch로 빈 배열(선례 동일).
- `buildFtsQuery`를 `src/db/fts.ts`로 추출해 transcripts.ts와 **공용화**(중복 구현 금지).

**UI**: 아카이브 검색에 '결정' 타입 칩 추가 — `SearchFilterChips`에 타입 추가, archive store 검색 액션에서 `searchDecisions` 병행 호출, 결과 렌더는 `TimelineDecisionItem` 재사용. 정렬·혼합 등 세부는 기존 검색 UX 관례를 따르고 과설계 금지.

### 수용 기준

인메모리 테스트(레시피 참조): ① 결정 INSERT → summary 토큰 검색 히트 ② user_summary UPDATE → 새 텍스트 히트·옛 텍스트 미히트 ③ soft delete → 미히트 ④ backfill 확인(마이그레이션 전 INSERT분) ⑤ 결정당 FTS 행 정확히 1개. 추가로 기존 `searchTranscripts` 회귀 없음 + verify PASS.

---

## D2. 회고 대조 + learnings 수집

### 설계 (확정) — 스키마 변경 없음 (`outcomes.learnings` 기존 컬럼 사용)

**OutcomeEditor** (`src/components/OutcomeEditor.tsx`):

- props에 decision(최소 `expectedOutcome`·`confidence`) 추가. 호출처는 `app/(tabs)/inbox.tsx` 2곳 — 이미 decision 객체를 갖고 있다.
- 에디터 상단에 "당시 기대" 블록: expectedOutcome + 확신도(%). expectedOutcome 없으면 블록 생략.
- reflection 아래 "다음에 적용할 교훈 (선택)" 입력 추가. `onSubmit(result, reflection?, learnings?)`로 시그니처 확장 — inbox store의 outcome 기록 액션 → `insertOutcome`까지 관통 확인(`insertOutcome`은 이미 learnings 파라미터 지원).

**표시**: decisions 모아보기(`DecisionList`) 상세 확장의 outcome 표시에 learnings 추가.

### 수용 기준

tsc 통과(시그니처 관통 강제) + 에뮬레이터에서: 기대 블록 표시/생략 두 케이스, learnings 입력 저장 후 상세에 표시. verify PASS.

---

## D3. Obsidian export 확장 + follow-up 알림

### D3-a. export 확장

`buildDecisionCallout`(`src/services/obsidian/export.ts`)에 다음을 있을 때만 추가:
상황(user 우선), 이유(user 우선), 기대(expectedOutcome), 확신도(%), outcome.learnings("**교훈**").
Dataview 질의 가능하도록 callout 제목 줄 다음에 인라인 필드 한 줄 추가(확정 형식):

```
> [category:: 커리어] [confidence:: 0.8] [result:: good]
```

**재export dirty 조사(필수)**: 회고(outcome) 저장 시 해당 entry의 `exported_at`이 리셋되는지 호출 경로를 추적하라. 리셋이 없으면 outcome 기록 경로에 `clearExportedAt`(`src/db/repos/entries.ts`) 호출 추가 — 자동 export 설정 게이트는 기존 관례를 따른다.

### D3-b. follow-up 로컬 알림

expo-notifications는 의존성에 있으나 현재 사용처 0. **SDK 55 문서 확인 필수**(권한·Android 채널·스케줄 API가 구 버전과 다를 수 있음).

확정 설계 — 서비스 신설 `src/services/followUpNotifications.ts`:

- 로컬 알림, identifier = decision.id (중복 스케줄 방지 키).
- 스케줄: 결정이 confirmed/edited이고 follow_up_at 존재 시 그 시각으로.
- 취소/재스케줄: outcome 기록·반려·삭제 시 취소, follow_up_at 변경 시 재스케줄.
- 부트 재동기화: `_layout` 부트스트랩에서 due 목록 기준으로 스케줄 정합 복구. 이미 지난 시각 분은 알림을 새로 쏘지 않고 기존 인앱 배지에 맡긴다.
- 알림 탭 → `/inbox` 딥링크(후속확인 탭).
- 권한: settings에 토글 + 최초 활성화 시 권한 요청. 거부 시 조용히 비활성(개인 도구 — 재촉 UI 불필요).

### 수용 기준

export: 전 필드/최소 필드/outcome+learnings 3케이스 문자열 출력을 콘솔 스냅샷으로 확인.
알림: 에뮬레이터에서 1~2분 뒤 follow_up 설정 → 발화 → 탭 → inbox 진입 확인, 취소 경로(회고 기록) 1회 확인. verify PASS.

---

## D4. 축적 활용 — 대시보드 · 링크 · 재부상 · tags (D1 완료 전제)

### D4-a. 결정 리뷰 대시보드

`src/db/repos/stats.ts`에 `getDecisionPerformance(db)` 신설:

- **byCategory**: 카테고리(user 우선, custom_category 있으면 그 라벨)별 outcome result 분포.
- **calibration**: confidence 구간 `[0,0.6) / [0.6,0.8) / [0.8,1.0]` × 실제 good율.
  good율 = good / (good+bad+mixed) — unclear·skipped 제외. 표본 5 미만 구간은 `lowSample: true`.
- **executionLagDays**: confirmed_at→executed_at 경과일 중앙값.

UI(확정): `/decisions` 화면 상단 접이식 "통계" 섹션. 새 컴포넌트 `src/components/decision/DecisionStats.tsx`, 기존 `DonutChart`·`ChartLegend` 재사용.

### D4-b. decision_links 가동 (v1부터 존재하는 미사용 테이블)

- repo 신설 `src/db/repos/decisionLinks.ts`: `insertDecisionLink`, `getLinksForDecision`(양방향 조회), `deleteDecisionLink`(테이블에 deleted_at 없음 — 하드 delete가 맞다. soft delete를 추가하지 마라).
- 흐름(확정): 결정 confirm 성공 직후 D1의 `searchDecisions`로 summary 토큰 검색 → 자기 자신·같은 entry 제외 top 3 → "비슷한 과거 결정" 카드(요약 + outcome 뱃지) 표시 → **사용자가 선택한 것만** `link_type='similar'`로 저장. 자동 저장 금지(노이즈 방지).
- 표시: `DecisionList` 상세 확장에 "연관 결정" 행(요약 + 결과 뱃지).

### D4-c. On-this-day 결정 카드

`OnThisDayStrip` 패턴 재사용: n년 전 오늘 confirmed된 결정 + outcome 뱃지 카드.
repo에 `getDecisionsOnThisDay` 신설 — 날짜 경계는 `@/lib/time`의 day boundary 유틸 준수(자정 하드코딩 금지).

### D4-d. tags_json 처리 (확정)

**제거하지 않는다** — 컬럼 drop은 decisions 테이블 재생성(FTS 트리거 함정 포함)을 요구해 비용 > 효용. `schema.ts`의 해당 컬럼에 "예약 컬럼(현재 미사용)" 주석만 추가. label 추출에 tags를 포함시키는 확장은 이 가이드 범위 밖 — 별도 승인 없이 하지 마라.

---

## 진행 순서와 보고

- 순서: **D1 → D2 → D3 → D4**. D2·D3은 상호 독립이라 병행 가능. D4는 D1 의존.
- phase마다 별도 세션 권장(컨텍스트 오염 방지). 한 phase 안에서도 "한 번에 한 파일" 원칙.
- 완료 보고 양식: ① 변경 파일 목록 ② 수용 기준 항목별 결과 ③ verify 출력 ④ CLAUDE.md 변경 이력 행 추가 ⑤ 이 문서와 코드의 충돌 발견 시 그 내용.
- phase 완료 시 이 문서의 해당 섹션에 `✅ 완료(날짜)` 를 표기하고, D4까지 끝나면 INDEX.md에서 상태를 '이력(구현 반영)'으로 바꾼다.
