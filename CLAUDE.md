# SnackShot — 동영상 다이어리

본인 사용 도구. AI 어시스턴트와의 페어 코딩으로 개발 중.
모든 의사결정은 `SnackShot-ADR.md`와 `SnackShot-ADR-Phase0.md`에 기록되어 있다.
문서 권위 등급(어떤 문서를 규칙으로 따를지)은 `docs/INDEX.md`를 따른다.
UI/UX는 `SnackShot-DesignSystem.md`(디자인 시스템)와 `src/theme/`(디자인 토큰)을 기준으로 한다.

## 기술 스택
- React Native 0.83 + Expo SDK 55 (Dev Client, New Architecture)
- TypeScript strict mode
- expo-router (file-based routing, Next.js app router 유사)
- Zustand (상태관리)
- expo-sqlite (openDatabaseAsync API만 사용, legacy API 금지)
- ULID (ID 생성)
- Zod (스키마 검증)
- date-fns (시간)

**⚠️ Expo SDK 55는 학습 데이터보다 최신이다.** 네이티브 모듈 API 사용 전 반드시 버전 문서(https://docs.expo.dev/versions/v55.0.0/)를 확인하라. 예: expo-file-system은 File/Directory 클래스 기반 동기 API로 전면 교체되어 구 `*Async` API(makeDirectoryAsync 등)는 런타임에서 throw한다.

## 설계 원칙 (ADR 요약)
1. **클립이 1급 객체** (ADR-003). Day는 시간순 그룹화 뷰.
2. **시각은 UTC Unix ms (INTEGER)** (ADR-013). UI 표시 시에만 로컬 변환.
3. **Soft delete** (ADR-014). 모든 쿼리에 `WHERE deleted_at IS NULL`.
4. **ID는 ULID** (ADR-009). `@/lib/id.ts`의 `newId()` 사용.
5. **DB 컬럼 snake_case ↔ TS 객체 camelCase**. 변환은 repo 안에서 (ADR 본문).
6. **AI 원본 보존** (ADR-016). 사용자 편집본은 별도 컬럼.
7. **Transcript는 별도 테이블** (ADR-010). 1:N.
8. **백그라운드 큐는 DB 기반** (ADR-012). ai_jobs 테이블.
9. **STT/AI 라벨링은 인터페이스로 추상화** (ADR-002, ADR-008). 구현체 교체 자유.

## 폴더 컨벤션
- `app/` — expo-router 화면 (직접 수정)
- `src/db/` — schema, migrations, repos (snake_case SQL은 여기만), `mapping.ts`(row→도메인 매퍼 빌더 `makeRowMapper`)
- `src/services/` — STT, label, video, jobs (인터페이스 + 구현체 분리)
- `src/stores/` — zustand stores
- `src/components/` — 재사용 UI (화면별 하위 폴더 가능, 예: `archive/`)
- `src/lib/` — id, time 등 유틸
- `src/types/` — 도메인 타입 (camelCase)
- `src/theme/` — 디자인 토큰(색·타이포·간격·그림자·모션). 원시 palette는 내부 전용
- `@/` alias → `src/`

## 코딩 스타일
- async/await (Promise.then 금지)
- 함수형 repo (클래스/DI 금지)
- 명시적 타입 (`any` 금지, `unknown`은 OK)
- 한 파일 200줄 이내 권장
- import는 `@/...` 우선
- 한 번에 한 파일씩 단순하게
- 색·간격·라운드·그림자·폰트는 `@/theme` 토큰 사용. 텍스트는 `theme.text.*` 프리셋 경유

## 작업 흐름
1. 변경 후 `npm run verify` 통과 확인 (= `tsc --noEmit` + 불변식 `scripts/check-invariants.sh` + 마이그레이션 append-only `scripts/check-migrations.mjs`; CI `verify.yml`와 동일)
2. DB 관련 변경은 콘솔 로그로 동작 확인
3. UI 변경은 에뮬레이터 시각 확인 (Metro reload)
4. ADR 위반 시 즉시 지적

## 절대 금지
- ADR 결정 임의 변경 (질문 후 ADR 갱신)
- `expo-sqlite` legacy callback API 사용
- `any` 타입
- snake_case 변수명 (DB row 매핑 외)
- expo-av 사용 (deprecated, expo-video/expo-audio 사용)
- 색상값(`#RRGGBB`)·스타일 매직넘버 하드코딩 (토큰 사용. 신규 값 필요 시 토큰에 추가 후 참조)
- `src/theme/tokens.ts`의 `palette` 직접 import (semantic 토큰 경유)

## 하네스: SnackShot 개발

**목표:** DB/Service/UI 레이어별 전문 에이전트가 협력하여 ADR 원칙을 준수한 기능을 구현한다.

**트리거:** 코드를 직접 변경하는 개발 요청 시 `feature-dev` 스킬을 사용하라. 단순 질문·설명·ADR 검토는 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-10 | 초기 구성 | 전체 | - |
| 2026-06-11 | ADR 파일명 오타 수정 (ShackShot→SnackShot) | SnackShot-ADR.md | planner가 메인 ADR을 읽지 못하던 문제 |
| 2026-06-11 | grep 오탐 수정(멀티라인 SQL, withTransactionAsync), 허용 예외 명시, 파일 크기 경고 추가 | agents/qa-engineer.md | 첫 QA 실행이 가짜 FAIL을 내는 문제 |
| 2026-06-11 | 서비스 구조도 현행화 + "실제 파일 우선" 원칙 | agents/service-engineer.md | 문서-코드 drift (ISttService/JobRunner 등 실존하지 않는 구조) |
| 2026-06-11 | 라우트 맵 현행화 + store 데이터 접근 규칙 현실화 | agents/ui-engineer.md | 문서-코드 drift, 사문화된 규칙 |
| 2026-06-11 | ADR-011 오인용 수정 | agents/db-engineer.md | 잘못된 근거 인용 |
| 2026-06-11 | 구현 에이전트에 원요청 요약 전달, 완료 보고에 하네스 개선점 항목 추가 | skills/feature-dev | 뉘앙스 손실 방지, 피드백 루프 가동 |
| 2026-06-11 | Expo SDK 55 문서 확인 지침 흡수 (AGENTS.md 고아화 해소), _workspace gitignore | CLAUDE.md, .gitignore | 지침이 어떤 에이전트에게도 전달되지 않던 문제 |
| 2026-06-15 | 디자인 시스템/토큰 신설(`src/theme/`, `SnackShot-DesignSystem.md`), 토큰 사용 규칙·하드코딩 금지 추가 | CLAUDE.md, src/theme, agents/ui-engineer.md | UI/UX 개편 기반 마련, 화면별 색 하드코딩 제거 |
| 2026-06-16 | P0 리팩토링: 죽은 stub(WhisperSttService) 제거, AGENTS.md→포인터, 탐색문서 `docs/explorations/` 격리 + `docs/INDEX.md` 권위표 신설, 에이전트 문서 구조 스냅샷→코드 진실원 전환·도메인 드리프트 수정, `_workspace_prev*` 제거 | 전체 하네스·docs | 문서-코드 드리프트 차단, AI 컨텍스트 비용 절감 |
| 2026-06-16 | P1 리팩토링: `INVARIANTS.md`(기계가독 규칙표, qa grep과 1:1) 신설, 도메인 enum 단일 진실원 `src/types/enums.ts`로 통합(domain.ts·label/schema.ts 재사용), schema.ts 반복 FTS 트리거·인덱스 SQL 상수 추출(컴파일 MIGRATIONS 바이트 동일 검증, 621→512줄) | INVARIANTS.md, src/types/enums.ts, src/db/schema.ts, 하네스 | enum 다중 동기화 제거, 규칙 로드 비용↓ |
| 2026-06-16 | P2-2: 불변식 자동 게이트 신설 — `scripts/check-invariants.sh`(오탐0 부분집합 하드 강제)·`scripts/check-migrations.mjs`(마이그레이션 append-only 해시 락 `migrations.lock.json`), `npm run verify` + CI `verify.yml`(tsc+불변식+마이그레이션)로 연결 | scripts/, .github/workflows/verify.yml, package.json, INVARIANTS.md, qa-engineer.md | 규칙을 사후 grep→작성시점 강제로 이동, 회귀 차단 |
| 2026-06-16 | P2-1: repo row↔도메인 매핑 표준화 — `src/db/mapping.ts`의 `makeRowMapper<T>` 도입, entries/transcripts/decisions/outcomes/aiJobs의 손수 `to*()` 매퍼·Row 인터페이스를 카탈로그 기반으로 전환(도메인 필드 누락을 컴파일 타임 강제), 검색 Entry 매퍼 중복 제거(toEntry 재사용) | src/db/mapping.ts, src/db/repos/*, db-engineer.md | 컬럼 추가 시 수작업 동기화 지점 축소, 누락 매핑 버그 차단 |
| 2026-06-16 | P3 리팩토링: archive 화면의 캘린더 표현 컴포넌트(CalendarDay/WeekStrip/PhotoStack)를 `src/components/archive/CalendarParts.tsx`로 분리(680→531줄), `docs/CODEMAP.md`(엔티티/화면 역색인) 신설, 주요 화면에 `@codemap` 헤더 추가 | app/(tabs)/*, app/entry, src/components/archive, docs/CODEMAP.md | 대형 파일 컨텍스트 비용↓, AI 탐색성↑ |
| 2026-06-16 | 검토 후속: P2-1에서 도입했으나 미사용으로 남은 헬퍼(`sqlCheck`/`makeGuard`) 제거(자기 도그푸딩 — dead code 금지), `makeRowMapper`에 `__DEV__` 'req' 컬럼 누락 경고 추가(컬럼명 오타 조기 발견) | src/types/enums.ts, src/types/domain.ts, src/db/mapping.ts, INVARIANTS.md | 미사용 표면 축소, 매퍼 컬럼명 안전 보완 |
| 2026-06-16 | A: preview(영상)·preview-audio(오디오)의 중복 저장 파이프라인(파일 이동→insertEntry→상태/메모→outcome/export→잡 큐잉)을 `src/services/saveCapturedEntry.ts` 단일 경로로 추출, 화면은 입력수집·UI 전환만 담당 | src/services/saveCapturedEntry.ts, app/preview*.tsx, docs/CODEMAP.md | 저장 로직 SoT화, 분기(mode) 일원화 |
| 2026-06-16 | B: `services/jobs/handlers.ts`(304줄)를 잡 타입별 파일로 분리 — `handlers/{compression,stt,obsidianExport,labelExtraction}.ts` + 제어흐름 에러 `signals.ts` + `index.ts` 배럴. 함수 본문 바이트 동일, queue.ts import 무변경(`./handlers`→디렉토리) | src/services/jobs/handlers/*, docs/CODEMAP.md | 핸들러 탐색성↑, 타입별 격리 |