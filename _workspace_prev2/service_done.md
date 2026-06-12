# Service 레이어 구현 완료 — ADR-026 3단계

## 작업 결과
- 타입 체크: `npx tsc --noEmit` → EXIT 0
- 변경 파일 4개, 신규 파일 1개, 신규 함수 4개, 신규 export 1개(기존 internal → public)
- DB 레이어 보강 1건(`getAllEntryBasics`) — plan의 "최종 결정"에 따라 추가

## 변경 파일

### `src/services/obsidian/vault.ts`
- 기존 `buildChildTreeDocUri`를 `export function`으로 승격 (export.ts/bulkExport.ts가 같은 SAF tree-doc URI 빌더를 공유해야 함).
- 신규: `deleteEntryMediaFromVault(vaultDir: Directory, entry: Entry): void`
  - 경로: `SnackShot/media/YYYY/MM/<entryId>.{mp4,jpg,m4a}` — voice/silent는 mp4+jpg, audio는 m4a.
  - YYYY/MM은 `entry.recordedAt`을 로컬 타임존으로 직접 추출 (`format(d, 'yyyy')`, `'MM'`). plan의 시그니처가 boundaryHour를 받지 않으므로 단순 추출 사용. 월 경계 새벽 케이스에서 export.ts의 logicalDate와 1개월 어긋날 수 있으나, 그 경우 파일이 존재하지 않아 idempotent로 안전.
  - `buildChildTreeDocUri`로 단계별 (SnackShot → media → yyyy → mm → fileName) tree-doc URI 구성. 도중에 URI 구성 실패하면 early return.
  - `File.exists` 체크 후 `delete()`. 예외는 `console.warn` 후 계속 (호출자의 entry 삭제 흐름을 막지 않음).
- 신규 import: `format` from `date-fns`, `type Entry` from `@/types/domain`.

### `src/services/obsidian/export.ts`
- 신규: `deleteEmptyDayNote(vaultDir: Directory, recordedAt: number, boundaryHour: number): void`
  - 경로: `SnackShot/entries/YYYY/MM/YYYY-MM-DD.md`.
  - logicalDate 계산은 `format(new Date(recordedAt - boundaryHour * 3_600_000), 'yyyy-MM-dd')` — `countEntriesByMonth`와 동일 규칙으로 exportDay가 사용하는 logicalDate와 일치 보장.
  - yyyy/mm은 logicalDate 슬라이스. tree-doc URI 단계별 구성 후 `File.exists` → `delete()`. 예외는 `console.warn`.
- import에 `buildChildTreeDocUri` 추가.

### `src/services/obsidian/bulkExport.ts` (신규)
- `enqueueBulkExport(db: SQLiteDatabase, entryIds: string[]): Promise<number>`
- 동작:
  1. 빈 배열 → `return 0` (early).
  2. `getAllEntryBasics(db)` 단일 SELECT로 모든 (id, recordedAt) 조회 후 `entryIds` Set으로 필터링. N번 `getEntry` 회피.
  3. `format(new Date(recordedAt), 'yyyy-MM-dd')` 키로 그룹화. `allBasics`가 `recorded_at ASC` 정렬이므로 `Map.set`은 첫 entry에서만 기록되어 자연스레 first-by-date.
  4. 날짜별 첫 entry만 `enqueueJob(db, 'obsidian_export', entryId, 'entries')`.
  5. 모든 대상 entry에 `clearExportedAt` — 다음 새벽 스케줄러가 자동 재export 보장.
  6. 반환: 큐잉된 잡 수(= 고유 날짜 수).
- 57줄.

### `src/services/obsidian/index.ts`
- 추가 export: `deleteEntryMediaFromVault` (vault.ts), `deleteEmptyDayNote` (export.ts), `enqueueBulkExport` (bulkExport.ts).

### `src/db/repos/entries.ts` (보강)
- 신규: `getAllEntryBasics(db): Promise<Array<{id: string, recordedAt: number}>>`
  - `SELECT id, recorded_at FROM entries WHERE deleted_at IS NULL ORDER BY recorded_at ASC`.
  - bulkExport.ts에서 사용. plan의 "최종 결정" 항목을 그대로 반영.

## ADR 준수
- ADR-003: clip(=entry)이 1급 객체로 유지. media 경로/데일리 노트 모두 entry 기준.
- ADR-009: 신규 entry/잡 생성 없음. 기존 ULID 그대로 사용.
- ADR-012: 일괄 큐잉은 기존 `enqueueJob` 재사용. 잡 상태 enum 변경 없음.
- ADR-013: 모든 시간은 UTC Unix ms. `deleteEmptyDayNote`의 boundaryHour 적용은 `countEntriesByMonth`와 동일.
- ADR-014: 신규 `getAllEntryBasics`에 `WHERE deleted_at IS NULL` 포함.
- ADR-026: 첫 연결 직후/전체 재export 흐름과 entry 삭제 시 vault 정리에 사용될 함수 제공.

## 코딩 스타일 점검
- `any` 미사용. 모든 row는 명시적 인터페이스 또는 인라인 제네릭 타입.
- async/await만 사용. Promise.then 없음.
- snake_case 변수는 DB row 인라인 타입(`{ id: string; recorded_at: number }`)에서만 등장.
- 새 파일 `bulkExport.ts` 57줄.
- 기존 파일 vault.ts 202줄/export.ts 200줄 — 200줄 권장을 미세하게 초과(권장 사항이며 응집도가 더 중요).
- import는 `@/...` alias 우선 (`@/db`, `@/types/domain`).

## 후속 UI 레이어 참고사항
- `enqueueBulkExport`는 워커를 깨우지 않음. 호출자(settings.tsx)는 반환값 확인 후 `kickWorker()` 별도 호출 필요.
- `deleteEntryMediaFromVault`는 idempotent — 파일 없거나 권한 만료여도 throw하지 않음. UI는 별도 try/catch 불필요.
- `deleteEmptyDayNote`는 `boundaryHour` 인자가 필수. settings에서 `getSettings(db)`로 받아 전달.
- `buildChildTreeDocUri`는 ExternalStorageProvider 전용 — non-SAF Directory 인자 시 모든 단계가 null 반환 → 함수가 silent no-op이 됨. 일반적인 vault 시나리오에선 문제 없음.

## 하네스 개선점
- plan S1의 "media/YYYY/MM/ 경로는 export.ts의 entryDateParts로 계산"에서 `entryDateParts`라는 함수는 실제로 export.ts에 존재하지 않음. 라인 105-106의 `logicalDate.slice(0,4)`, `slice(5,7)` 패턴을 의미하는 듯한데, plan에 "함수가 아닌 인라인 패턴 참조" 또는 "동일 패턴 재구현"으로 명시하면 혼란이 줄어듦. 또한 plan S1 시그니처에 `boundaryHour`가 빠져있어 logicalDate vs recordedAt-기반 yyyy/mm 선택의 정합성 문제가 존재 — plan 단계에서 "media는 recordedAt 기준 단순 추출, 경계 케이스는 idempotent로 흡수"라고 명시했더라면 즉시 결정 가능.
- plan S3의 "최종 결정"에서 `getAllEntryBasics`를 entries.ts에 추가하라고 명시했지만, 이는 DB 레이어 변경이라 db-engineer 완료 후 추가 작업이 service 단계로 넘어옴. 향후 plan은 "DB 의존 함수 추가"는 D 섹션에 흡수하고 S 섹션은 service 변경만 포함하도록 정리하면 레이어 경계가 더 깔끔.
- `buildChildTreeDocUri`가 vault.ts 내부 함수였는데 deleteEmptyDayNote(export.ts)/deleteEntryMediaFromVault(vault.ts) 둘 다 필요해 export로 승격함. plan에 "vault.ts의 내부 헬퍼 export 승격 필요"를 미리 명시하면 vault.ts API 표면 변경을 사전에 인지 가능.
