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
| `AGENTS.md` | CLAUDE.md로의 포인터 | 규칙 본문 미보유 |

## 코드 진실원 (코드 자체가 사양)

문서 스냅샷이 아니라 **실제 파일을 읽어 현재 구조·시그니처·enum을 파악**한다. 문서와 코드가 다르면 **코드가 이긴다.**

| 주제 | 진실원 파일 |
|------|------------|
| 도메인 타입·enum(EntryMode, ProcessingStatus, AiJobType 등) | `src/types/domain.ts` |
| DB 스키마·마이그레이션 | `src/db/schema.ts`, `src/db/migrations.ts` |
| repo 함수 목록 | `src/db/repos/*`, 배럴 `src/db/index.ts` |
| 서비스 인터페이스/구현 | `src/services/{stt,label,jobs,obsidian}/` |
| 라우트 | `app/` 디렉토리 구조 |
| 디자인 토큰 | `src/theme/` |

## 비규범 문서 (참고 — 따르지 않음)

| 문서 | 상태 |
|------|------|
| `docs/explorations/SnackShot-Phase6-Prompts.md` | 이력(구현 완료 아카이브) |
| `docs/explorations/SnackShot-reorder-analysis.md` | 탐색(미구현) |
| `docs/explorations/SnackShot-vad-analysis.md` | 탐색(미구현) |
| `docs/explorations/SnackShot-tiered-compression-analysis.md` | 탐색(미구현) |
| `SnackShot-Refactoring-Plan.md` | 리팩토링 계획(제안). 실행 시 항목별로 규범화 여부 결정 |

## 하네스 문서

`.claude/agents/*.md`, `.claude/skills/feature-dev/SKILL.md`는 **에이전트 동작 규칙**이다.
이 문서들은 도메인 구조를 스냅샷으로 복제하지 않는다 — 도메인 사실은 위 "코드 진실원"에서 직접 읽는다.
