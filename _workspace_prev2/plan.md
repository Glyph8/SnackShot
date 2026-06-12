# 구현 계획: ADR-026 3단계 — Obsidian 연동 상태 UI 및 통제 기능

## 필요 에이전트
- [x] db-engineer
- [x] service-engineer
- [x] ui-engineer

## DB 레이어 태스크

### D1. `src/db/repos/aiJobs.ts` — Obsidian export 집계 함수
```typescript
export interface ObsidianExportStats {
  lastSuccessAt: number | null;  // MAX(completed_at) WHERE status='done'
  pendingCount: number;          // status IN ('pending','running')
  failedCount: number;           // status='failed'
}
export async function getObsidianExportStats(db: SQLiteDatabase): Promise<ObsidianExportStats>
```
단일 쿼리: SELECT MAX/SUM 집계. snake_case row → camelCase 반환.

### D2. `src/db/repos/aiJobs.ts` — 실패 잡 재시도
```typescript
export async function retryFailedObsidianExports(db: SQLiteDatabase): Promise<number>
// UPDATE ... SET status='pending', scheduled_at=now, last_error=NULL, attempts=0
// WHERE job_type='obsidian_export' AND status='failed'
// 반환: changes (영향받은 row 수)
```

### D3. `src/db/repos/aiJobs.ts` — pending 잡 취소
```typescript
export async function cancelPendingObsidianExports(db: SQLiteDatabase): Promise<void>
// UPDATE ... SET status='cancelled', completed_at=now
// WHERE job_type='obsidian_export' AND status IN ('pending','running')
```

### D4. `src/db/repos/entries.ts` — 재export용 조회
```typescript
export async function countAllEntries(db: SQLiteDatabase): Promise<number>
// SELECT COUNT(*) FROM entries WHERE deleted_at IS NULL

export async function getAllEntryIds(db: SQLiteDatabase): Promise<string[]>
// SELECT id FROM entries WHERE deleted_at IS NULL ORDER BY recorded_at ASC
```
ADR-014: WHERE deleted_at IS NULL 필수.

## Service 레이어 태스크

### S1. `src/services/obsidian/vault.ts` — vault 미디어 삭제
```typescript
export function deleteEntryMediaFromVault(vaultDir: Directory, entry: Entry): void
```
- media/YYYY/MM/<entryId>.{mp4,m4a,jpg} 삭제 (모드별 분기)
- buildChildTreeDocUri로 tree-doc URI 구성 → File.exists → File.delete()
- 파일 없으면 무시 (idempotent), 예외는 console.warn 후 계속

### S2. `src/services/obsidian/export.ts` — 빈 날 처리
exportEntry에서 같은 날 entry가 없으면 데일리 노트 삭제는 워커가 처리하므로
별도 함수 추가:
```typescript
export function deleteEmptyDayNote(vaultDir: Directory, recordedAt: number, boundaryHour: number): void
```
entries/YYYY/MM/YYYY-MM-DD.md를 buildChildTreeDocUri로 찾아 삭제. 파일 없으면 무시.

### S3. `src/services/obsidian/bulkExport.ts` (새 파일) — 일괄 export
```typescript
export async function enqueueBulkExport(
  db: SQLiteDatabase,
  entryIds: string[],
): Promise<number>  // 큐잉된 잡 개수 반환
```
- 각 entry의 recordedAt을 day 키(YYYY-MM-DD 로컬)로 환산
- 날짜별 첫 entry만 enqueueJob('obsidian_export', entryId, 'entries')
- clearExportedAt을 모든 entry에 적용
- 반환: 실제 큐잉 잡 수 (고유 날짜 수)

### S4. `src/services/obsidian/index.ts` 업데이트
deleteEntryMediaFromVault, deleteEmptyDayNote, enqueueBulkExport 노출

## UI 레이어 태스크

### U1. `app/(tabs)/settings.tsx` — 상태 표시 + 버튼 (요구사항 1·2·5)
- `useFocusEffect`에서 getObsidianExportStats(db) 조회
- pendingCount > 0이면 5초 폴링 (cleanup에서 clearInterval)
- 연결됨 카드 안에 추가:
  - 마지막 내보내기 시각 (없으면 "아직 내보내지 않음")
  - "대기 N건 · 실패 N건" (0이면 숨김)
  - failedCount >= 1 시 경고 배너 + [다시 시도] + [다시 연결]
  - [전체 다시 내보내기] 버튼

### U2. `app/(tabs)/settings.tsx` — 첫 연결 직후 프롬프트 (요구사항 3)
handleConnect 성공 분기 끝에:
```
countAllEntries(db) → N > 0 시
Alert "기존 일기 N개를 지금 내보낼까요?" → 확인 시
getAllEntryIds → enqueueBulkExport → kickWorker
```

### U3. `src/components/DeleteEntryDialog.tsx` — 삭제 다이얼로그 컴포넌트 (요구사항 4)
```typescript
interface Props {
  visible: boolean;
  vaultConnected: boolean;
  onCancel(): void;
  onConfirm(opts: { deleteFiles: boolean; deleteFromVault: boolean }): void;
}
```
Modal + 체크박스 두 개(로컬 파일 삭제 / 옵시디언에서도 삭제). 기본 둘 다 off.

### U4. `app/entry/[id].tsx` — 삭제 흐름 업데이트 (요구사항 4)
- DeleteEntryDialog 사용
- deleteFromVault=true 시:
  1. deleteEntryMediaFromVault(vaultDir, entry)
  2. softDeleteEntry
  3. deleteFiles if deleteFiles=true
  4. siblings 조회 → 있으면 enqueueJob + kickWorker
  5. siblings 없으면 deleteEmptyDayNote + kickWorker

## ADR 검토
- ADR-013: lastSuccessAt은 INTEGER ms. UI 표시만 로컬 변환 ✓
- ADR-014: countAllEntries/getAllEntryIds에 WHERE deleted_at IS NULL ✓
- ADR-012: 일괄 큐잉도 enqueueJob 재사용 ✓
- Migration 불필요: schema TARGET_VERSION=6, 모든 컬럼 존재 ✓
- any 타입 금지 ✓

## 주의사항
- 새 migration 파일 생성 금지 (기존 ai_jobs/entries/settings 활용)
- completed_at 컬럼이 ai_jobs에 존재하는지 schema.ts에서 확인 필요
- retryFailedObsidianExports의 scheduled_at 갱신 시 Date.now() 사용
