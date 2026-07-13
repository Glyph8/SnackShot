# [승인·반영됨 → ADR-028] 미결(deliberating) 결정: "고민 중" 단계의 1급 도입

> ✅ 2026-07-10 승인 → SnackShot-ADR.md ADR-028로 반영, v21로 구현 완료. 이 파일은 이력용.

# [원 초안] 미결(deliberating) 결정: "고민 중" 단계의 1급 도입

> 등급: 탐색/제안(draft). **승인 전까지 SnackShot-ADR.md(권위)에 반영하지 않으며, 구현에 착수하지 않는다** (DecisionSupport-Investment-Guide F5의 확정 범위).
> 승인 시: 아래 "신설 블록"을 SnackShot-ADR.md에 새 번호(ADR-028 예상 — 반영 시점의 마지막 번호+1로 확정)로 추가하고, CLAUDE.md 변경 이력·`docs/INDEX.md`를 갱신한 뒤 구현한다.
> 작성일: 2026-07-10. 근거 조사: `src/types/enums.ts`(DECISION_STATUS)·`src/db/schema.ts` v1 decisions CHECK(212행)·`src/db/repos/decisions.ts` 쿼리 전수·F1~F4 구현 표면.

---

## 왜 필요한가 (요약)

현재 결정 라이프사이클은 전부 **사후**다 — `extracted`(AI 후보)→`confirmed`/`edited`(확정)/`rejected`(결정 아님). "A vs B를 아직 고민 중"이라는, **도움이 가장 필요한 단계를 저장할 곳이 도메인에 없다.** F1~F4로 확정 "시점"에 과거(유사 결정·교훈)가 개입하게 됐지만, 결정을 **미뤄둔 기간** 동안은 앱이 아무것도 못 한다.

첫 실사용처는 **H4의 이벤트 대기 매매**다: "실적 발표 보고 삼성전자 매수 결정" = 미결 상태 + 마감일(발표일) + 마감 알림 + 그 시점에 과거 유사 매매·교훈 자동 첨부. 이 시나리오(EX1·CEX1 few-shot의 소재이기도 하다)가 현 도메인에서는 confirmed로 저장할 수밖에 없어 "보류하기로 한 결정"과 "이미 내린 결정"이 구분되지 않는다.

status enum 확장은 decisions 테이블 CHECK 재생성 + 화면·쿼리 전반 영향이라 **ADR 승인 사항**이다(CLAUDE.md 절대 금지: ADR 임의 변경).

---

## 신설 블록 (승인 시 SnackShot-ADR.md에 추가할 텍스트)

### ADR-0XX: 미결(deliberating) 결정 상태

**Status:** proposed **Date:** 2026-07-10

#### Situation

결정 상태가 전부 사후(extracted/confirmed/edited/rejected)라 "고민 중" 단계를 기록·지원할 수 없다. 사용자가 결정을 유예하는 기간이 실재하고(특히 이벤트 대기 투자), 이 기간에야말로 축적된 과거 기록(F1 유사 결정·F2 교훈)이 개입할 가치가 가장 크다.

#### Task

미결 상태를 도메인에 도입하되 ① 기존 확정 결정의 통계·보드·export·digest를 오염시키지 않고 ② 확정 전이 시 데이터 연속성(ID·검색·링크)을 유지하며 ③ 스키마·화면 변경을 최소화한다.

#### Action — 검토한 대안

| 대안 | 내용 | 평가 |
|------|------|------|
| 1. 별도 테이블(deliberations) | 미결 전용 테이블, 확정 시 decisions로 복사 승격 | 오염 원천 차단이지만 FTS·decision_links·화면 전부 재구현, 승격 시 ID 단절. 비용 최대 |
| 2. 플래그 컬럼(is_deliberating) | status는 confirmed인 채 플래그만 | 기존 화이트리스트 쿼리(`status IN ('confirmed','edited')`)에 전부 `AND NOT is_deliberating` 추가 필요 — 누락 시 통계·보드 오염. status 의미론 이중화 |
| **3. status에 'deliberating' 추가** | enum·CHECK 확장, 같은 행에서 상태 전이 | **기존 쿼리가 전부 명시적 화이트리스트라 미결이 자동 제외됨(누락 오염 불가능). 확정 시 같은 행 UPDATE — ID·FTS·링크 연속. extracted라는 '대기 상태' 선례와 일관 (선택)** |

#### Action — 최종 선택

1. **`DECISION_STATUS`에 `'deliberating'` 추가** (`src/types/enums.ts` 먼저 — INV-enum-source). 마이그레이션 vNEXT: decisions **CHECK 재생성 = 테이블 재생성** — v18 선례(새 테이블→INSERT SELECT→DROP→RENAME→인덱스 재생성) + **decisions_fts 트리거 3개 선제 DROP·후행 재생성**(D1 함정 목록 1번 — 트리거 상수 옆 경고 주석이 이미 있다).
2. **같은 마이그레이션에 `decide_by INTEGER` 컬럼 추가**(결정 마감 시각, nullable, UTC ms — ADR-013). `follow_up_at`(확정 후 후속)과 의미가 달라 별도 컬럼: 미결의 마감 vs 확정의 회고 시점.
3. **대안 후보는 기존 `alternatives` TEXT를 재사용**("A / B" 나열 — G1 개정 프롬프트와 동일 규약). 선택지별 구조화(각 대안의 예상 결과·확신도)는 **미채택** — 과설계이며, H1 `structured_json`은 매매 필드 전용으로 유지한다(용도 혼합 금지). 재검토 조건: "안 고른 대안 회고" 수요가 실사용에서 확인되면.
4. **생성 경로는 의도적 작성만**: compose 화면에 "아직 결정 못 했어요" 토글 → `status='deliberating'`, `origin='authored'`, summary만 필수(canSave 완화), decide_by 선택 입력. **AI 추출발 미결은 1차 제외** — 전사에서 "고민 중"을 추출하면 E2가 억제한 과추출이 재발한다. 재검토 조건: 미결 기능 정착 후 별도 평가.
5. **상태 전이**:
   - `deliberating → confirmed/edited`: 보드 "결정했다" 액션 → EditDecisionSheet 재사용(요약 정리·ConfidenceChips 확신도·후속일 설정) → `confirmed_at` 기록, follow_up 알림 sync. **이 플로우 진입 직전에 `PastDecisionsSheet`(F1)를 자동 표시** — 마감 시점 과거 개입이 이 기능의 존재 이유다.
   - 폐기(고민을 접음): **soft delete** (ADR-014). `rejected`는 "결정이 아니었다"는 의미라 오용하지 않는다.
   - 마감 경과: 상태 자동 변경 **없음** — 보드에서 "마감 지남" 강조만(자동화 미채택, 사용자 주도).
6. **마감 알림**: `followUpNotifications` 재사용 — `shouldSchedule`에 분기 추가: `status==='deliberating' && decideBy != null && decideBy > now`. identifier=decision.id(한 결정은 한 상태라 충돌 없음), 제목 "결정할 시간", 본문 summary, 탭 딥링크 /inbox. resync 순회 대상에 미결 조회 추가.

#### Result — 트레이드오프

- **얻은 것**: 결정 유예 기간의 1급 기록, 마감 알림 + 그 시점의 과거 개입(F1·F2 재사용), H4 이벤트 대기 매매의 기반. 화이트리스트 쿼리 구조 덕에 기존 통계·digest·export 무변경.
- **잃은 것**: decisions 테이블 재생성 마이그레이션 1회(FTS 트리거 함정 — 선례로 관리 가능), 보드에 섹션 1개 추가로 복잡도 소폭 증가.
- **재검토 조건**: 미결이 쌓이기만 하고 확정 전이가 드물면(방치 패턴) 마감 기본값·리마인드 정책 재설계.

---

## 기존 화면·쿼리 영향 목록 (구현 시 전수 확인)

| 표면 | 영향 | 조치 |
|------|------|------|
| `src/types/enums.ts` DECISION_STATUS | 확장 | `'deliberating'` 추가(진실원 먼저) |
| `src/db/schema.ts` vNEXT | 테이블 재생성 | CHECK 확장 + `decide_by` + FTS 트리거 3개 DROP/재생성(D1 함정) + lock 갱신 |
| `src/db/mapping.ts`·`domain.ts` | 필드 추가 | `decideBy?: number` 카탈로그 등록(컴파일 강제) |
| `app/compose-decision.tsx` | 생성 경로 | 미결 토글 + summary만 필수 + decide_by 입력 |
| inbox 보드(`app/(tabs)/inbox.tsx`·store) | 신규 섹션 | "고민 중 · N건"(decide_by 임박순, 경과 강조), 액션: 결정했다(F1 시트→EditDecisionSheet)/접기(soft delete). 신규 repo `getDeliberatingDecisions` |
| `DecisionList`(전체 목록) | 쿼리 확장 | `getAllDecisions`가 `IN ('confirmed','edited','rejected')` — deliberating 포함 + '미결' 배지 표시 |
| 아카이브 검색 | 자동 노출 | `searchDecisions`는 status 무필터(rejected도 색인하는 D1 정책) → 미결도 검색됨. 결과 카드에 '미결' 배지만 추가 |
| 통계(`getDecisionPerformance`·`getEntryStats` 결정 집계) | **무변경** | 화이트리스트라 자동 제외 — 회귀 확인만 |
| digest(`getRecentDecisionDigest`)·F1(`getSimilarPastDecisions`) | **무변경** | confirmed/edited 한정이라 자동 제외 — AI 맥락 오염 없음 |
| 옵시디언 export | **무변경 예상** | export는 확정 시 enqueue — 미결은 대상 아님(구현 시 buildDecisionCallout 호출 경로만 확인) |
| `followUpNotifications` | 분기 추가 | shouldSchedule + resync 순회에 미결(decide_by) 포함 |
| `devSeed` | 시드 추가 | 마감 임박·마감 경과 미결 각 1건(시간 의존 테스트) |

## 수용 기준(개요 — 승인 후 구현 지시서 수준으로 상세화)

① 인메모리 v1→vNEXT: CHECK에 deliberating 포함·기존 행 보존·FTS 트리거 6케이스 회귀 ② 미결 저장→보드 "고민 중" 표시→"결정했다"→F1 시트→확정 전이(같은 id, confirmed_at 기록) ③ 통계·digest·유사검색에 미결 미포함(오염 없음) ④ decide_by 알림 예약·마감 경과 강조 ⑤ 접기 후 어디에도 미표시 ⑥ verify PASS.

---

## 승인 요청

이 방향(대안 3: status 확장 + decide_by 마감 + 알림/과거 개입은 기존 인프라 재사용)으로 진행해도 될까요? 승인하시면 신설 블록을 SnackShot-ADR.md에 반영(CLAUDE.md 이력·INDEX 갱신)한 뒤, 구현은 별도 세션에서 마이그레이션→repo→화면 순으로 진행합니다. H 트랙과의 순서는 자유지만, H4(이벤트 대기 매매)보다 먼저 완료되면 H4가 이 상태를 바로 쓸 수 있습니다.
