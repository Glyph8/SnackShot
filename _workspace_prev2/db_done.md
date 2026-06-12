# DB 레이어 구현 완료 — ADR-026 3단계

## 작업 결과
- 타입 체크: `npx tsc --noEmit` → EXIT 0
- 변경 파일 2개, 신규 함수 5개, 신규 타입 1개

## 변경 파일

### `src/db/repos/aiJobs.ts`
신규 export:
- `interface ObsidianExportStats { lastSuccessAt, pendingCount, failedCount }`
- `async getObsidianExportStats(db): Promise<ObsidianExportStats>` — 단일 SELECT, `MAX(CASE WHEN status='done' THEN completed_at END)` + 두 개의 `SUM(CASE WHEN ...)`로 집계. `job_type='obsidian_export'`만 대상.
- `async retryFailedObsidianExports(db): Promise<number>` — `UPDATE ai_jobs SET status='pending', scheduled_at=nowMs(), last_error=NULL, attempts=0 WHERE job_type='obsidian_export' AND status='failed'`. `result.changes` 반환.
- `async cancelPendingObsidianExports(db): Promise<void>` — `UPDATE ... SET status='cancelled', completed_at=nowMs() WHERE job_type='obsidian_export' AND status IN ('pending','running')`.

### `src/db/repos/entries.ts`
신규 export:
- `async countAllEntries(db): Promise<number>` — `SELECT COUNT(*) ... WHERE deleted_at IS NULL`.
- `async getAllEntryIds(db): Promise<string[]>` — `SELECT id ... WHERE deleted_at IS NULL ORDER BY recorded_at ASC`.

## 스키마 검증
- `ai_jobs.completed_at` 컬럼: v1부터 존재 (`src/db/schema.ts` L148). v6에서 재생성된 테이블에도 보존됨.
- `ai_jobs.job_type` CHECK에 `'obsidian_export'` 포함 (v6, L456).
- `entries.deleted_at` 컬럼 + `idx_entries_recorded_at WHERE deleted_at IS NULL` 부분 인덱스로 `countAllEntries`/`getAllEntryIds` 둘 다 인덱스 적용 가능.
- Migration 추가 없음 (TARGET_VERSION=6 유지).

## ADR 준수
- ADR-009/013: ULID/ms는 기존 컬럼 그대로.
- ADR-014: 신규 entries 함수 2개 모두 `WHERE deleted_at IS NULL` 포함.
- ADR-012: 잡 상태 전이는 기존 enum (`pending`/`running`/`failed`/`cancelled`) 안에서만 처리.
- snake_case 변수는 row 인터페이스(`ObsidianExportStatsRow`)에만 등장. 반환 객체는 camelCase.
- `any` 미사용. 모든 SQL 결과는 명시적 row 타입으로 제네릭 지정.
- async/await 사용 (Promise.then 없음).

## re-export
`src/db/index.ts`가 이미 `export * from './repos/aiJobs'`와 `export * from './repos/entries'`로 모든 멤버를 재노출 중. 별도 수정 불필요.

## 후속 레이어 참고사항
- `getObsidianExportStats`는 `pendingCount=0 && failedCount=0` 케이스도 항상 객체 반환 (NULL 코얼레싱). UI는 0 체크로 분기.
- `retryFailedObsidianExports`는 attempts를 0으로 리셋함 — 워커의 max attempts 정책이 있다면 사용자 명시적 재시도 의미와 일치.
- `cancelPendingObsidianExports`는 `running` 상태도 포함하므로 워커가 동시에 진행 중인 잡의 결과 처리 시 status 확인 필요 (워커 측 책임).
- `getAllEntryIds`는 `recorded_at ASC` (오래된 것부터) 정렬. service S3의 "날짜별 첫 entry" 선택은 이 정렬을 그대로 활용 가능.

## 하네스 개선점
- 계획 D1에는 `completed_at` 컬럼 존재 여부 사전 확인 지시가 있었고 실제로 v1부터 존재했음. 향후 비슷한 사전 확인 단계는 plan 단계에서 schema.ts grep 결과를 명시해 두면 구현 에이전트의 의심 단계가 더 짧아짐.
- `src/db/index.ts`는 와일드카드 re-export 패턴이라 신규 함수 추가 시 자동 노출됨. plan 본문 "src/db/index.ts에서 re-export" 항목은 실질적으로 no-op — plan에 "기존 와일드카드 export로 자동 노출됨, 추가 작업 없음"으로 명시하면 잘못된 추가 편집을 예방.
