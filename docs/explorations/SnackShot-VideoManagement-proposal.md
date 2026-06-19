# 영상 관리(다단계 압축 + 원본 백업) 구현 계획 — 제안

> 상태: **탐색/제안** (아직 ADR 아님). 권위 등급은 `docs/INDEX.md` 기준 최하위.
> 확정 시 ADR-022(압축)·ADR-012(큐)·ADR-014(soft delete) 개정 또는 신규 ADR로 승격.
> 작성: 2026-06-19

## 1. 요구사항 정리

1. **N개월 지난 영상에 자동 적용** + **직접(수동) 적용** 둘 다 가능.
2. **압축 3단계**: 1단계 = 현재 기본 압축, 2·3단계 = 비트레이트/해상도 심화 압축.
3. **3단계 후 원본을 내보내기 쉽게** → 외부 저장장치 백업 용이(개월 단위 폴더, zip 검토).
4. 각 영상의 **현재 단계·백업 여부**를 보고 **손쉽게 관리**.

## 2. 현재 구조 (출발점)

- 압축은 단일 단계다. `src/services/jobs/handlers/compression.ts`의 `handleCompression`이 `react-native-compressor`의 `Video.compress`로 540p/1.5Mbps 1회 압축, 썸네일 생성 후 `compressed.mp4`/`thumbnail.jpg`를 영구 경로로 이동한다(원본 `original.mp4`는 보존).
- 상태는 `entries.compression_status`(ProcessingStatus enum: pending/processing/done/failed/skipped) **하나뿐** — "몇 단계인지"·"백업했는지" 개념이 없다.
- 파일 경로: `src/lib/storage.ts`의 `buildEntryPaths` → `{document}/entries/{yyyy}/{MM}/{dd}/{entryId}/{original|compressed}.mp4`. 용량 집계 `getStorageBreakdown`(월별 포함)이 이미 있고 `SettingsStats.tsx`에서 사용 중.
- 백그라운드 작업은 DB 큐(`ai_jobs`, ADR-012). 단일 워커(`queue.ts`), `enqueueJob`, 재시도 3회, `payload_json` 컬럼 존재. 잡 타입은 `AI_JOB_TYPE` enum.
- 외부 폴더 쓰기는 SAF로 이미 구현됨(옵시디언). `src/services/obsidian/vault.ts`의 `Directory.pickDirectoryAsync`, `buildChildTreeDocUri`, `safGetOrCreateDir/File`가 SAF의 까다로운 제약(tree-doc URI, createFile만 write 가능 등)을 이미 흡수.
- 설정은 싱글톤 row(`settings`), additive ADD COLUMN으로 확장하는 패턴.

이 자산을 최대한 재사용한다. 특히 **SAF 내보내기는 옵시디언 vault 헬퍼를 그대로 재활용**한다.

## 3. 핵심 설계 결정

### 3.1 단계 모델 — 항상 "원본에서" 재압축

각 단계는 직전 압축본이 아니라 **원본(`original.mp4`)에서** 해당 단계 파라미터로 재압축해 `compressed.mp4`를 교체한다. 압축본을 또 압축하면 화질 손실이 누적되기 때문. 따라서:

- `compressed.mp4`는 항상 "현재 단계의 1개" 파일(다단계 사본을 쌓지 않음 → 용량 절감 목적에 부합).
- 단계 상향은 원본이 로컬에 있어야 가능. **3단계 도달 + 백업 완료 후에만 원본 로컬 삭제** 가능(아래 3.3). 원본 삭제 후 단계는 동결.
- 단계별 권장 파라미터(기본값, 설정에서 조정 가능하게):

| 단계 | 긴 변 px | 비트레이트 | 용도 |
|------|---------|-----------|------|
| 1 기본 | 960 (≈540p) | 1.5 Mbps | 현재 값(ADR-022) |
| 2 심화 | 854 (≈480p) | 0.8 Mbps | 수개월 경과 |
| 3 최대 | 640 (≈360p) | 0.4 Mbps | 장기 보관·백업 직전 |

**예상 용량(2분 영상 기준, MB ≈ Mbps × 15 + 오디오 ~1.9MB):**

| 단계 | 2분 예상 | 원본 대비 |
|------|---------|----------|
| 원본 (1080p ~12Mbps 가정) | ~180 MB (기기따라 120~300) | — |
| L1 (540p/1.5M) | ~24 MB | ~87%↓ |
| L2 (480p/0.8M) | ~14 MB | ~92%↓ |
| L3 (360p/0.4M) | ~8 MB | ~96%↓ |

가장 큰 절감은 L1(180→24MB). L2·L3는 단계당 ~40% 추가 절감이나 절대량은 작아(10MB대→8MB) 영상이 많이 쌓였을 때 효과가 큼. `bitrate`는 목표값이라 실제는 ±편차가 있고 원본이 4K/HEVC면 수치가 크게 달라진다.

### 3.2 상태 추적 (데이터 모델)

`compression_status`(작업 진행상태)는 그대로 두고, **달성 단계**와 **백업 상태**를 분리해 추가한다.

`entries`에 additive 컬럼(마이그레이션 v11):
- `compression_level INTEGER NOT NULL DEFAULT 0` — 0=원본만, 1/2/3=달성 단계. 백필: `UPDATE ... SET compression_level=1 WHERE compression_status='done'`.
- `original_backed_up_at INTEGER` — 원본 백업 완료 시각(null=미백업).
- `original_purged_at INTEGER` — 원본 로컬 삭제 시각(null=원본 보유).
- `backup_uri TEXT` — 백업 위치 표시용(선택).

이러면 UI에서 "L2 · 백업됨 · 원본정리됨" 같은 상태를 한눈에 보여줄 수 있고, 표시 경로(`compressed_path ?? original_path`)는 영향 없음.

`settings`에 additive 컬럼:
- `auto_manage_enabled INTEGER NOT NULL DEFAULT 0`
- `auto_l2_after_months INTEGER`(기본 3), `auto_l3_after_months INTEGER`(기본 6), `auto_backup_after_months INTEGER`(기본 12)
- `auto_purge_original INTEGER NOT NULL DEFAULT 0` — 백업 후 원본 자동 삭제 여부
- `backup_dir_uri TEXT` — 백업용 SAF 폴더(옵시디언 vault와 별개로 선택)

### 3.3 백업·원본 정리 라이프사이클

`L3 도달` → `원본 백업(SAF 월 폴더로 복사)` → `original_backed_up_at` 기록 → (설정 시) `원본 로컬 삭제` → `original_purged_at` 기록. 안전장치: **백업 성공 확인 전에는 원본을 절대 삭제하지 않는다**(복사 후 크기/존재 검증).

### 3.4 내보내기 형식 — 폴더 복사 우선, zip은 선택

- **권장(1차)**: 백업 SAF 폴더에 `SnackShot-Backup/YYYY-MM/{entryId}_original.mp4`로 **복사**. 사용자는 그 폴더(또는 월 하위폴더)를 외부 저장장치로 옮기면 끝. 온디바이스 zip이 불필요해 메모리/시간 부담이 없고, 옵시디언 SAF 헬퍼를 그대로 재사용 가능.
- **선택(후순위)**: 월 단위 zip 패키징. `react-native-zip-archive` 같은 **네이티브 모듈 추가 → Dev Client 재빌드 필요**(EAS), 대용량 영상 zip의 메모리/시간 리스크가 있어 별도 단계로 분리. 폴더 복사로 먼저 충족시키고, zip은 "월 폴더를 묶어 1파일로" 옵션으로 추가.

> SAF는 Android 전용. iOS는 `file://` 경로 + 공유 시트가 필요하나, 본 앱은 위젯·SAF 등 Android 중심이므로 1차 구현은 Android SAF 기준. iOS 분기는 옵시디언과 동일 전략으로 후속.

## 4. 작업 단위 (잡 큐 통합)

ADR-012 큐를 확장한다.

- **재압축**: `AI_JOB_TYPE`의 기존 `'compression'`을 재사용하되 `payload_json = { "level": 2 }`로 목표 단계를 전달. `handleCompression`이 payload의 level(기본 1)을 읽어 파라미터 테이블에서 스펙 선택, **원본에서** 재압축 후 `compressed.mp4`/썸네일 교체 + `compression_level` 갱신. `enqueueJob`에 optional payload 인자 추가(additive).
- **원본 백업**: 신규 잡 타입 `'original_backup'` 추가. 핸들러 `handleOriginalBackup`: 백업 SAF 폴더의 `YYYY-MM/`에 원본 복사 → 검증 → `original_backed_up_at` 기록 → (설정 시) 원본 삭제 + `original_purged_at`.
  - ⚠️ `ai_jobs.job_type` CHECK에 값 추가는 SQLite 특성상 **테이블 재생성**이 필요(v6의 obsidian_export 추가 선례 그대로). v11에서 동일 절차로 처리.
- **우선순위**: 유지보수성 대량 재압축이 STT/label을 막지 않도록, 유지보수 잡은 `scheduled_at`을 약간 미래로(또는 별도 낮은 우선순위) 두는 방안 검토. 워커는 단일 직렬이므로 최소한 신규 녹화 처리가 굶지 않게 분산.

## 5. 자동 적용(스윕) vs 수동

- **자동**: `sweepVideoMaintenance(db)` — 설정의 임계 개월(기본 3→L2, 6→L3, 12→백업, **확정**)을 읽어, `recorded_at`이 N개월 이전이고 아직 목표 단계 미만/미백업인 활성(`deleted_at IS NULL`) 엔트리를 찾아 해당 잡을 `enqueueJob`. 호출 시점: `startWorker` 진입 시 1회 + 하루 1회(스케줄/앱 포그라운드 진입). 멱등(이미 큐에 있거나 단계 충족이면 skip). `auto_manage_enabled`로 전체 on/off.
- **수동(확정 요구)**: 자동과 무관하게 **사용자가 고른 일부 영상**에 원하는 단계 압축·백업을 직접 적용할 수 있어야 한다. 관리 화면에서 단일/다중 선택(체크) 후 "L2/L3로 압축", "원본 백업"을 즉시 enqueue + `kickWorker()`(STT 재생성과 동일 패턴). Entry 상세에서도 개별 적용.

## 6. 관리 UI (확정)

- **진입(확정)**: Settings에 별도 "**용량 관리**" 항목을 만들어 전용 화면 `app/storage.tsx`로 라우팅. 그 화면이 **현재 통계(`SettingsStats`의 `getStorageBreakdown` 내용)** + **관리 페이지**를 함께 담는다. (`decisions.tsx`가 Archive에서 진입하는 것과 동일한 라우팅 패턴.)
- **조회·필터(확정 요구)**: 단계별(L0/L1/L2/L3) 항목과 백업 상태(미백업/백업됨/원본정리됨)로 **간단히 조회·필터**. 월별 그룹 + 단계 분포/백업 진행률 표시. 각 항목에서 단계·백업 상태를 **수정**(단계 올리기/백업) 가능.
- **다중 선택 + 일괄 액션(확정 요구)**: 체크 선택 후 "L2/L3로 압축", "원본 백업", "월 폴더 내보내기". 특히 **백업된 항목 일괄 원본 삭제**(편의 기능) — 백업 완료(`original_backed_up_at NOT NULL`) & 원본 보유(`original_purged_at IS NULL`) 항목만 대상으로 모아 보여주고, **확인 다이얼로그 후** 로컬 원본 일괄 삭제 → 절감 용량 미리보기 표시.
- **엔트리 단위**: `entry/[id].tsx`에 단계·백업 배지 + 개별 수동 액션(다음 단계 압축/백업/원본 열기·삭제). 배지·버튼은 `@/theme` 토큰·`Tag`·`Button` 재사용.
- 진행 중 잡은 기존 `ai_jobs` 상태로 표시(압축 중/백업 중).

## 7. 마이그레이션 (v11, append-only)

1. `entries` ADD COLUMN ×4 (위 3.2). 백필 1줄(`compression_level=1 WHERE compression_status='done'`).
2. `settings` ADD COLUMN ×6 (기본값 포함).
3. `ai_jobs` job_type CHECK에 `'original_backup'` 추가 → **테이블 재생성**(v6 선례: 새 테이블 생성 → INSERT SELECT → DROP → RENAME → 인덱스 2개 재생성). FTS 트리거 없음이라 v3/v7식 트리거 드롭은 불필요.
4. `src/types/enums.ts`에 `AI_JOB_TYPE`에 `'original_backup'` 추가, 단계 enum/상수 추가. CHECK 문자열은 schema.ts에 인라인 복제(standalone 컴파일 제약).
5. `node scripts/check-migrations.mjs --update`로 락 갱신, `npm run verify` 통과 확인.

## 8. 권장 단계별 구현 순서 (PR 분할)

- **P0 — 데이터 모델**: v11 마이그레이션 + repo(단계/백업 갱신 함수) + 도메인 타입 + 배지 읽기 전용 표시. (동작 변화 없음, 안전.)
- **P1 — 다단계 압축**: `handleCompression` payload level화 + 단계 파라미터 + 원본에서 재압축 + 썸네일 교체. 수동 "다음 단계" 버튼.
- **P2 — 백업/정리**: `original_backup` 잡 + SAF 월 폴더 복사(옵시디언 헬퍼 재사용) + 검증 후 원본 삭제(설정 게이트) + 상태 기록.
- **P3 — 자동 스윕**: 설정 임계값 UI + `sweepVideoMaintenance` + 호출 지점.
- **P4 — 관리 화면**: 월별/엔트리별 뷰 + 일괄 액션.
- **P5(선택) — zip 패키징**: 네이티브 zip 모듈 + Dev Client 재빌드(이 단계만 빌드 영향).

## 9. 리스크·주의

- **원본 삭제는 비가역**. 백업 성공 검증(파일 존재 + 크기 일치) 전 삭제 금지. 설정 기본 off.
- **재압축은 원본 필요** → 원본 정리 후 단계 동결. UX에 명시.
- **SAF 신뢰성**: 권한 만료/폴더 이동 시 `assertVaultWritable` 패턴으로 명확한 한국어 에러 + "폴더 다시 선택" 유도. 백업 폴더도 동일.
- **워커 직렬성**: 대량 재압축이 신규 처리(STT 등)를 막지 않도록 스케줄 분산.
- **zip는 빌드 영향**: 네이티브 모듈이라 Expo 버전 문서 확인 + Dev Client 재빌드 필요. 그래서 후순위 분리.
- **마이그레이션 append-only**: 기존 SQL 수정 금지, v11 신규로만. ai_jobs CHECK는 재생성 절차 준수.

## 10. 확정된 결정 (2026-06-19)

1. **압축 스펙**: L1 540p/1.5M(현행), L2 480p/0.8M, L3 360p/0.4M 기본값으로 시작. (2분 영상 기준 ~24/14/8MB.)
2. **자동 임계 개월**: 3→L2, 6→L3, 12→백업. + **수동으로 일부 영상에 원하는 단계/백업 직접 적용** 필수.
3. **내보내기**: 월 폴더 복사 우선. zip은 후순위(P5).
4. **원본 자동 삭제**: 기본 off, 수동 확인 후 삭제. 단 **단계별/백업 항목 조회·수정** + **백업된 항목 일괄 삭제 편의 기능** 제공.
5. **관리 UI**: Settings에 "용량 관리" 항목 → `app/storage.tsx`(통계 + 관리) 라우팅.

→ 다음 단계: P0(데이터 모델 v11)부터 구현 착수 가능.
