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
| 2026-06-17 | 버그 수정: record.tsx의 `recordAsync`를 try/catch/finally로 감싸 네이티브 녹화 실패 시 uncaught rejection·UI 멈춤 방지(에뮬레이터 가상카메라 미지원 등) | app/record.tsx | 크래시→graceful 안내 |
| 2026-06-17 | 대형 화면 분할(P3-1 후속): settings/entry/today의 프레젠테이션 블록을 `src/components/{settings,entry,today}/`로 추출 — settings(533→348: KeyInputRow·ObsidianSyncSection), entry(416→338: FailureCard·EntryTextSection), today(408→300: TodayHeader·TodayComposer·ScrollFab). 화면은 상태·핸들러만, 컴포넌트는 props 기반 순수 렌더 | app/(tabs)/settings·today, app/entry, src/components/{settings,entry,today} | 화면 파일 컨텍스트 비용↓, 재사용 가능 | 
| 2026-06-17 | archive 검색 UI 분리: 검색바·최근검색·결과상태 블록을 `src/components/archive/ArchiveSearchBar.tsx`로 추출(535→472), store 접근은 부모가 props로 주입 | app/(tabs)/archive, src/components/archive | 검색 UI 격리, 화면 본문 축소 |
| 2026-06-20 | ADR-005 개정(Revision): 녹화 일시정지/이어찍기 도입 + 3분 상한을 누적 녹화시간 기준으로 재정의(영상은 `toggleRecordingAsyncAvailable` 게이팅). 초안 `docs/explorations/ADR-005-revision-draft.md` 승인 후 반영 | SnackShot-ADR.md, docs/INDEX.md, app/record*.tsx | 한 호흡 녹화 제약 해소 |
| 2026-07-03 | `.gitattributes` 신설(`* text=auto`, `*.sh`/`gradlew`는 `eol=lf` 강제) + 워킹트리 CRLF 스크립트 LF 복구 | .gitattributes, scripts/check-invariants.sh, android/gradlew | 워킹트리 전체 CRLF 변환으로 250개 파일 phantom-modified + 로컬 `npm run verify`가 bash CRLF 오류로 깨지던 문제 |
| 2026-07-03 | check-invariants.sh 강건화: grep exit≥2(실행 오류)를 하드 실패(exit 2)로 처리하는 `g()` 래퍼 도입, 저장소 루트 사전 가드 추가, `set -euo pipefail` | scripts/check-invariants.sh | grep이 잘못된 경로/패턴으로 죽어도 빈 결과=✓ 통과로 처리되던 조용한 오탐 차단 |
| 2026-07-03 | CODEMAP/INDEX 현행화: 6/16 이후 신규 표면 등재(TextRevision 엔티티, video/widget 서비스, original_backup 잡, storage·storage-files·compose-decision·decisions 라우트), INDEX enum 진실원 domain.ts→enums.ts 정정, 탐색문서 6건 상태 등재·정정 | docs/CODEMAP.md, docs/INDEX.md | 문서-코드 드리프트 해소(영상관리·위젯·결정작성 기능이 역색인에 없던 문제) |
| 2026-07-03 | v14 마이그레이션: `fts_entries_insert_note` 트리거(AFTER INSERT WHEN manual_note IS NOT NULL) 추가, insertTextEntry의 동일 값 더미 UPDATE 우회 제거. 인메모리 SQLite로 v1→v14 전체 실행 + 트리거 6케이스 동작 검증 | src/db/schema.ts, src/db/repos/entries.ts, scripts/migrations.lock.json | 텍스트 entry FTS 인덱싱이 repo의 더미 UPDATE 주석에 의존하던 함정 제거(쓰기 2회→1회, 스키마가 정합성 보장) |
| 2026-07-03 | 의사결정 강화 구현 지시서(D1~D4) 신설: 결정 FTS(v15)·회고 대조+learnings·export 확장+알림·대시보드/decision_links. 설계 확정치·함정 목록·수용 기준·인메모리 검증 레시피 포함. 기능 평가 결론: 저장 형태는 충분, 회수(검색·대조·연결·집계) 경로가 부재 | docs/explorations/SnackShot-Decision-Enhancement-Guide.md, docs/INDEX.md | 후속 구현 세션(Opus급)이 재설계 없이 기계적으로 실행 가능하도록 결정 고정 |
| 2026-07-03 | 사용 피드백 구현 지시서(E1~E3) 신설: E1 옵시디언 수신함 import(Inbox.md 단방향 채널, obsidian_import 잡, 해시 중복 방어), E2 추출 정밀도(중대성 기준·EX2 교체·confidence 접힘·반려 이력 few-shot 주입·hint 활용), E3 개인화(Profile.md + 최근 결정 다이제스트, 자동 메모리는 보류 결정). 권장 순서 E2→E1→E3, D 트랙과 마이그레이션 버전 조율 규칙 명시 | docs/explorations/SnackShot-UserFeedback-Guide.md, docs/INDEX.md | 과추출 원인(EX2 few-shot·무필터)을 코드에서 확정 진단, 양방향 sync 대신 수신함 설계로 위험 축소 |
| 2026-07-03 | D1 구현: 결정 전문검색 v15 `decisions_fts`(요약/상황/이유 user 우선 + 커스텀 카테고리 색인, insert/update/soft_delete 트리거 3개, rejected 포함 backfill) + `buildFtsQuery`를 `src/db/fts.ts`로 추출(transcripts/decisions 공용) + `searchDecisions` repo + 아카이브 '의사결정' 검색 칩(병행 검색·TimelineDecisionItem 렌더). 인메모리 v1→v15 수용기준 5개 통과, verify PASS | src/db/schema.ts, src/db/fts.ts, src/db/repos/{decisions,transcripts}.ts, src/stores/archive.ts, src/components/archive/SearchFilterChips.tsx, app/(tabs)/archive.tsx | 결정 회수 경로(검색) 신설 — Decision-Enhancement-Guide D1 |
| 2026-07-03 | D2 구현: 회고 대조 + learnings 수집(스키마 변경 없음, `outcomes.learnings` 재사용). OutcomeEditor에 `decision` 기반 '당시 기대'(expectedOutcome+확신도%, 없으면 생략) 블록·'다음에 적용할 교훈' 입력 추가, `onSubmit(result, reflection?, learnings?)` 확장 → inbox 화면 handleOutcome → store recordOutcome → insertOutcome까지 learnings 관통(tsc 강제). DecisionList 상세에 '교훈' 표시. verify PASS | src/components/OutcomeEditor.tsx, app/(tabs)/inbox.tsx, src/stores/inbox.ts, src/components/decision/DecisionList.tsx | 회고 회수(기대 대조·교훈 축적) 경로 신설 — Decision-Enhancement-Guide D2 |
| 2026-07-03 | D3 구현: (a) 옵시디언 export 확장 — buildDecisionCallout에 상황/이유(user 우선)·기대·확신도%·교훈 추가 + 제목 다음 줄 Dataview 인라인 필드(`[category::][confidence::][result::]`), 실제 함수 3케이스 콘솔 스냅샷 통과. 재export dirty는 기존 maybeEnqueueReExport(전일 재생성)로 이미 커버되어 clearExportedAt 불필요(코드 우선 판정). (b) 후속 확인 로컬 알림 — expo-notifications SDK55 API(설치 패키지 타입으로 확인: DATE 트리거 type 필드·shouldShowBanner/List·granted) 기반 `followUpNotifications` 서비스(schedule/cancel/resync, identifier=decision.id 중복방지, Android 채널, 권한요청, 포그라운드 핸들러), v16 `settings.notifications_enabled` + 설정 토글, 확정/수정→sync·반려/회고/삭제→cancel 배선, `_layout` 부트 재동기화 + 응답 리스너 딥링크(/inbox). 인메모리 v1→v16 통과, verify PASS. 알림 발화·탭은 에뮬레이터 검증 필요 | src/services/obsidian/export.ts, src/services/followUpNotifications.ts, src/db/schema.ts, src/db/repos/settings.ts, src/components/settings/NotificationSection.tsx, app/_layout.tsx, app/(tabs)/settings.tsx, src/stores/inbox.ts, app/(tabs)/archive.tsx, src/components/decision/DecisionList.tsx, scripts/migrations.lock.json | 결정 회수 강화(export 필드·Dataview) + 후속 확인 능동 알림 — Decision-Enhancement-Guide D3 |
| 2026-07-03 | D4 구현(의사결정 강화 완결): (a) `getDecisionPerformance`(카테고리별 결과분포·확신도 calibration good율·실행지연 중앙값) + `DecisionStats`(DonutChart/ChartLegend 재사용) /decisions 상단 접이식. (b) `decision_links` 가동 — `decisionLinks` repo(insert/getLinksForDecision 양방향/deleteDecisionLink 하드/getRelatedDecisions), 확정 직후 `SimilarDecisionsSheet`로 유사결정 top3 선택 저장(자동저장 없음), DecisionList 상세 '연관 결정' 표시. (c) `getDecisionsOnThisDay`(getOnThisDay 패턴) + `DecisionOnThisDay` 스트립. (d) tags_json '예약 컬럼' 주석은 v1 마이그레이션 SQL 수정=해시락 위반이라 domain.ts에 기재(코드 우선). 인메모리 v1→v16 13항목 통과, verify PASS | src/db/repos/{stats,decisions,decisionLinks}.ts, src/db/index.ts, src/types/domain.ts, src/components/decision/{DecisionStats,DecisionOnThisDay,SimilarDecisionsSheet,DecisionList}.tsx, app/(tabs)/inbox.tsx, app/decisions.tsx | 축적 회수(대시보드·연관·재부상) — Decision-Enhancement-Guide D4, 지시서 이력 전환 |
| 2026-07-03 | 에뮬레이터 피드백 반영: (1) Archive 검색 중복 수정 — 텍스트 엔트리가 곧 의사결정이면 메모 결과를 제외(결정 카드만), (2) 통계/이날의결정을 Inbox '전체 목록'(DecisionList showInsights)에서 보이게(/decisions는 nav 없는 딥링크였음), (3) `__DEV__` 전용 개발자 도구 카드 신설 — 설정 하단 텍스트 7탭으로 열림. `devSeed`(작년/재작년 오늘 결정·회고·링크·2분뒤 후속알림 시드 + 마커 기반 일괄 제거, FTS 잔여행 정리) + 알림 테스트(10초 발송·예약개수·전체취소·재동기화) + DB 상태. 인메모리 시드/제거 11항목 통과, verify PASS | app/(tabs)/{archive,inbox,settings}.tsx, src/db/repos/devSeed.ts, src/db/index.ts, src/services/followUpNotifications.ts, src/components/settings/DevToolsSection.tsx | 시간 의존 기능 테스트 가능화 + 검색/도달성 버그 수정 |
| 2026-07-03 | 개발자 도구 후속: 시드 텍스트 엔트리를 아카이브 브라우즈 뷰(캘린더·타임라인·이날의기억·검색)에서 숨김 — entries의 4개 조회 + searchTranscripts에 `metadata_json NOT LIKE '%"__seed__"%'` 추가. `getEntry`(단건)는 그대로라 인박스 보드/결정 기능은 정상. 프로덕션엔 마커가 없어 무영향. 인메모리 6항목 통과, verify PASS | src/db/repos/entries.ts, src/db/repos/transcripts.ts | 시드 데이터가 일반 열람에 노출되지 않도록(시드 엔트리 숨김) |
| 2026-07-03 | E2 구현(추출 정밀도): (a) prompts.ts 결정정의에 4번째 기준 '중대성'(되돌리기 어려움/돈·시간/영향 1주+) 추가 + EX2를 취침다짐→중대 daily(PT 3개월)로 교체, 취침다짐은 부정 EX4로 강등(few-shot 4개), buildUserMessage에 hint=0 경계주의 라인. (c) `getRecentRejectedSummaries`(rejected·user우선) + ExtractHints.recentRejectedSummaries + gemini `buildExtractionSystemText` 동적 블록(정적 SoT 불변, 사용자데이터 주입) + labelExtraction 배선. (d) hint 0/1 라인. (b) inbox `LOW_CONFIDENCE_THRESHOLD=0.6` — 덱은 high만, low는 `LowConfidenceCandidates` 접힘 그룹. 인메모리 반려조회 검증, verify PASS | src/services/label/{prompts,gemini,types}.ts, src/services/jobs/handlers/labelExtraction.ts, src/db/repos/decisions.ts, src/components/inbox/LowConfidenceCandidates.tsx, app/(tabs)/inbox.tsx | 과추출 억제(중대성 기준·반려 캘리브레이션·낮은확신 분리) — UserFeedback-Guide E2 |
| 2026-07-04 | E1 구현(옵시디언→SnackShot 수신함 import, 단방향 채널): AI_JOB_TYPE에 obsidian_import + v17(ai_jobs CHECK 재생성 v12패턴 + settings.obsidian_inbox_last_hash) + `readVaultTextFile`(vault.ts, SDK55 File.textSync) + `handleObsidianImport`(Inbox.md 읽기→djb2 해시 중복방어→'---' 블록 파싱→insertTextEntry+label/export 큐잉→저장 후 헤더만 남기고 비우기, 순서 확정) + `enqueueObsidianImport`(hasActiveJob 중복방지) + queue dispatch + `_layout` 부트·포그라운드 복귀 배선. 인메모리 v1→v17 + 파싱/해시 로직 검증, verify PASS. 파일 실제 읽기/쓰기는 에뮬레이터 검증 필요 | src/types/enums.ts, src/services/jobs/errors.ts, src/db/schema.ts, src/db/repos/settings.ts, src/services/obsidian/{vault,inboxImport,index}.ts, src/services/jobs/handlers/{obsidianImport,index}.ts, src/services/jobs/queue.ts, app/_layout.tsx, scripts/migrations.lock.json | 옵시디언 텍스트 유입 채널 신설 — UserFeedback-Guide E1 |
| 2026-07-04 | E3 구현(개인화, E1~E3 완결): (a) `readUserProfile`(vault SnackShot/Profile.md, 주석strip·2000자 절단·warn, 설정토글 없음) + setupSnackShotFolder에 Profile.md 템플릿(존재 시 보존, 프라이버시 헤더). (b) `getRecentDecisionDigest`(최근 7일 confirmed/edited user요약+outcome). `getAiContext`(프로필 항상 + 다이제스트 옵션). gemini 주입 매트릭스 — 추출=프로필O·다이제스트X(E2 반려와 이중주입 금지), compose/rewrite=프로필O·다이제스트O. labelExtraction/compose-decision/textRevision 배선. 인메모리 다이제스트·프로필파싱 + 매트릭스 구조 검증, verify PASS. 실제 API body는 에뮬레이터 검증 | src/services/obsidian/{profile,vault,index}.ts, src/services/label/{context,types,gemini}.ts, src/db/repos/decisions.ts, src/services/jobs/handlers/labelExtraction.ts, app/compose-decision.tsx, src/services/textRevision.ts | 개인화(프로필·최근맥락 주입) — UserFeedback-Guide E3, 지시서 이력 전환 |
| 2026-07-04 | 정기 점검(자동 실행): (1) D1~D4·E1~E3 핵심 심볼 17종 코드 존재 전수 확인 — 전부 배선 정상, (2) archive.tsx 분할 694→535 — `ArchiveCalendarCard`(ko 로케일·캘린더 테마·테이프/종이말림 카드)·`ArchiveTimelineList`(TimelineRow 타입 + `buildTimelineRows` 순수함수 + 타임라인 FlatList) 추출, JSX 이동만(동작 무변경 의도), verify PASS — 에뮬레이터 스모크(월/주/타임라인/검색) 권장, (3) 잘려 있던 `.expo/types/router.d.ts`(32바이트) 복구로 로컬 verify 정상화, (4) 점검 보고서 신설 — 다음 리팩토링 후보(settings 541·entry/[id] 516·repos/decisions 451), @codemap 미부착 8파일, Paperclip 미사용 표면, 다이어리 감성 제안 5건(작성면 괘선·도장 확대·날짜 소인 등, 미채택) | app/(tabs)/archive.tsx, src/components/archive/{ArchiveCalendarCard,ArchiveTimelineList}.tsx, docs/explorations/SnackShot-Periodic-Review-2026-07-04.md, docs/INDEX.md | 대형 화면 컨텍스트 비용↓(화면 추출 패턴 지속) + 계획 문서 구현 검증 |
