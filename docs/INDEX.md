# 문서 인덱스 — 권위 등급(authority map)

이 표는 **AI 에이전트가 어떤 문서를 "따라야 하는 규칙"으로 취급하고, 어떤 문서를 "참고 맥락"으로만 취급할지**를 정한다.
작업 시작 전 이 인덱스를 먼저 읽어 진실원(canonical source)을 식별하라.

## 규범 문서 (canonical — 항상 따른다)

| 문서 | 범위 | 비고 |
|------|------|------|
| `CLAUDE.md` | 기술 스택·코딩 스타일·절대 금지·하네스 | **최상위 진실원.** 충돌 시 이 문서가 이긴다 |
| `SnackShot-ADR.md` | 핵심 아키텍처 결정(ADR-001~017) | 결정 근거 서사 |
| `SnackShot-ADR-Phase0.md` | Phase 0 셋업 결정(ADR-018~023) | 결정 근거 서사 |
| `SnackShot-DesignSystem.md` | UI/UX 디자인 시스템 | UI 작업 시 필수 |
| `INVARIANTS.md` | 강제 가능한 불변식(기계가독 규칙표) | 항상. qa-engineer 검사와 1:1 |
| `AGENTS.md` | CLAUDE.md로의 포인터 | 규칙 본문 미보유 |

## 코드 진실원 (코드 자체가 사양)

문서 스냅샷이 아니라 **실제 파일을 읽어 현재 구조·시그니처·enum을 파악**한다. 문서와 코드가 다르면 **코드가 이긴다.**

| 주제 | 진실원 파일 |
|------|------------|
| 도메인 enum(EntryMode, ProcessingStatus, AiJobType 등) | `src/types/enums.ts` (P1에서 단일 진실원으로 통합, INV-enum-source) |
| 도메인 타입(Entry, Decision 등) | `src/types/domain.ts` |
| DB 스키마·마이그레이션 | `src/db/schema.ts`, `src/db/migrations.ts` |
| repo 함수 목록 | `src/db/repos/*`, 배럴 `src/db/index.ts` |
| 서비스 인터페이스/구현 | `src/services/{stt,label,jobs,obsidian,video,widget}/` + 루트 단일경로 서비스(`saveCapturedEntry` 등) |
| 라우트 | `app/` 디렉토리 구조 |
| 디자인 토큰 | `src/theme/` |

## 비규범 문서 (참고 — 따르지 않음)

`docs/CODEMAP.md` — 탐색 역색인(navigation aid). 규칙 아님, 코드 진실원 보조.

| 문서 | 상태 |
|------|------|
| `docs/explorations/SnackShot-Phase6-Prompts.md` | 이력(구현 완료 아카이브) |
| `docs/explorations/SnackShot-reorder-analysis.md` | 탐색(미구현) |
| `docs/explorations/SnackShot-vad-analysis.md` | 탐색(미구현) |
| `docs/explorations/SnackShot-tiered-compression-analysis.md` | 이력(영상 관리 다단계 압축으로 반영) |
| `docs/explorations/ADR-005-revision-draft.md` | 이력(ADR-005 Revision으로 반영 완료) |
| `docs/explorations/SnackShot-VideoManagement-proposal.md` | 이력(v12/v13 영상 관리로 구현 반영 — ADR 승격은 미완) |
| `docs/explorations/SnackShot-Inbox-Todo-proposal.md` | 이력(대부분 구현 반영: v8 위젯 TodoList·결정 보드. 문서 헤더의 '미구현' 표기는 stale) |
| `docs/explorations/SnackShot-UIUX-Improvement-Plan.md` | 이력(디자인 시스템·화면 개편으로 반영) |
| `docs/explorations/SnackShot-UIUX-Craft-Motion-Plan.md` | 이력(핸드메이드 감성·모션 개편으로 반영) |
| `docs/explorations/SnackShot-LongPress-CardActions.md` | 이력(롱프레스 카드 액션 구현 반영) |
| `docs/explorations/SnackShot-UIUX-Mockup.html`·`-Mockup-SVG.html` | 목업(참고용 시안) |
| `docs/explorations/SnackShot-Decision-Enhancement-Guide.md` | **구현 지시서(승인됨)** — 의사결정 강화 D1~D4. 구현 세션은 이 문서의 설계를 따른다. 완료 시 이력으로 전환 |
| `docs/explorations/SnackShot-UserFeedback-Guide.md` | **구현 지시서(승인됨)** — 사용 피드백 E1(옵시디언 수신함)·E2(추출 정밀도)·E3(개인화). 권장 순서 E2→E1→E3. 완료 시 이력으로 전환 |
| `SnackShot-Refactoring-Plan.md` | 리팩토링 계획(제안). 실행 시 항목별로 규범화 여부 결정 |

## 하네스 문서

`.claude/agents/*.md`, `.claude/skills/feature-dev/SKILL.md`는 **에이전트 동작 규칙**이다.
이 문서들은 도메인 구조를 스냅샷으로 복제하지 않는다 — 도메인 사실은 위 "코드 진실원"에서 직접 읽는다.
