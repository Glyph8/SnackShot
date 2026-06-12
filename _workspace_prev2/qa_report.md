# ADR-026 3단계 QA 리포트

- 검증 일자: 2026-06-11
- 대상: ADR-026 3단계(엔트리 삭제 흐름 / 옵시디언 설정 화면 / 일괄 export 큐잉)

## 결과: PASS

## 1. TypeScript 검사

```
npx tsc --noEmit
EXIT: 0
```

에러 없음.

## 2. ADR 위반 grep 검사

대상 파일 9개 전체:
- `src/db/repos/aiJobs.ts`
- `src/db/repos/entries.ts`
- `src/services/obsidian/vault.ts`
- `src/services/obsidian/export.ts`
- `src/services/obsidian/bulkExport.ts`
- `src/services/obsidian/index.ts`
- `src/components/DeleteEntryDialog.tsx`
- `app/(tabs)/settings.tsx`
- `app/entry/[id].tsx`

| 검사 항목 | 패턴 | 결과 |
|----------|------|------|
| `any` 타입 사용 | `: any\|as any\|<any>` | 매치 없음 |
| `Promise.then` 사용 | `\.then\(` | 매치 없음 |
| `expo-av` 사용 | `expo-av` | 매치 없음 |
| snake_case 변수 선언 | `(const\|let\|var)\s+[a-z]+_[a-z_]+\s*=` | 매치 없음 |
| snake_case 함수 선언 | `function\s+[a-z]+_[a-z_]+\(` | 매치 없음 |

### 2-1. ADR-014 `deleted_at IS NULL` 검사 — 신규 entries.ts 함수

| 함수 | 라인 | 포함 여부 |
|------|------|----------|
| `countAllEntries` | 235 | OK (`WHERE deleted_at IS NULL`) |
| `getAllEntryIds` | 243 | OK (`WHERE deleted_at IS NULL`) |
| `getAllEntryBasics` | 255 | OK (`WHERE deleted_at IS NULL`) |

### 2-2. aiJobs.ts 신규 함수 — `job_type = 'obsidian_export'` 스코프 검사

| 함수 | 스코프 | 비고 |
|------|--------|------|
| `getObsidianExportStats` | `WHERE job_type = 'obsidian_export'` | 단일 SELECT 집계 |
| `retryFailedObsidianExports` | `WHERE job_type = 'obsidian_export' AND status = 'failed'` | `attempts = 0` + `last_error = NULL` 리셋, `result.changes` 반환 |
| `cancelPendingObsidianExports` | `WHERE job_type = 'obsidian_export' AND status IN ('pending','running')` | `completed_at` 기록 |

세 함수 모두 다른 `job_type`(stt 등)에 영향을 주지 않음.

## 3. 의존성/통합 검사

- `src/db/index.ts`가 `export * from './repos/aiJobs'`, `'./repos/entries'`로 신규 함수 자동 노출 OK.
- `src/services/obsidian/index.ts`가 `deleteEntryMediaFromVault`, `deleteEmptyDayNote`, `enqueueBulkExport` 신규 export OK.
- `setObsidianAutoExport`, `setObsidianVaultUri`, `obsidianAutoExport`, `obsidianVaultUri`, `dayBoundaryHour` 모두 `repos/settings.ts`에 존재.
- `deleteEntryFiles`(`src/lib/storage.ts`), `kickWorker`(`src/services/jobs/queue.ts`) 모두 존재.
- `AiJobType`에 `'obsidian_export'` 포함(`src/types/domain.ts:127`), `AiJobStatus`에 `'cancelled'` 포함(`:134`).
- 워커 큐(`src/services/jobs/queue.ts:137`)에 `'obsidian_export'` case 핸들러 존재 — `enqueueBulkExport`로 큐잉된 잡 처리 가능.

## 4. 코딩 스타일 — 권장 사항

| 파일 | 줄 수 | 비고 |
|------|------|------|
| `src/db/repos/aiJobs.ts` | 228 | 200줄 권장 초과 (28줄) |
| `src/db/repos/entries.ts` | 259 | 200줄 권장 초과 (59줄) |
| `src/services/obsidian/vault.ts` | 202 | 200줄 권장 초과 (2줄) |
| `src/services/obsidian/export.ts` | 200 | 경계 |
| `app/(tabs)/settings.tsx` | 421 | 200줄 권장 크게 초과 |
| `app/entry/[id].tsx` | 369 | 200줄 권장 크게 초과 |

CLAUDE.md 기준 "한 파일 200줄 이내 권장"으로 명시되어 있으며 강제 금지가 아니다. ADR-026 3단계 범위에서는 기능 응집(설정 화면 단일 모듈, 엔트리 상세 단일 모듈)을 우선해 분리하지 않았다. 분할 여지가 있다는 점만 기록한다 — 후속 리팩토링 candidate:
- `app/(tabs)/settings.tsx`: 옵시디언 섹션을 `src/components/settings/ObsidianSection.tsx`로 분리 가능.
- `app/entry/[id].tsx`: 삭제 흐름(`handleConfirmDelete` 분기)을 `src/services/obsidian/deleteEntry.ts` 등으로 추출 가능.

## 5. 수정 사항

없음. 타입 통과, ADR 위반 패턴 없음, 의존성 모두 충족.

## 6. 메모

- `aiJobs.ts:215` `return result.changes` — `db.runAsync`의 반환 타입에 `changes: number`가 포함되어 있어 타입 안전(tsc 통과로 확인).
- `bulkExport.ts`의 그룹화 로직(라인 37–43)은 `getAllEntryBasics`가 `recorded_at ASC` 정렬이라는 가정에 의존한다. `entries.ts:244`/`:256`의 `ORDER BY recorded_at ASC`로 보장됨. 정렬을 바꾸면 first-by-date 의미가 깨지므로 주석에 가정 명시되어 있어 안전.
- `app/entry/[id].tsx:181` 빈 데일리 노트 삭제는 `boundaryHour`를 정확히 사용 → `deleteEmptyDayNote(vaultDir, entry.recordedAt, settings.dayBoundaryHour)` OK. 반면 `vault.ts:170` `deleteEntryMediaFromVault`는 `recordedAt`을 그대로 yyyy/MM에 사용(주석에 의도 명시: 월 경계 새벽 케이스 1개월 어긋날 수 있으나 idempotent — 파일이 없으면 무시). 정책으로 수용 가능.
