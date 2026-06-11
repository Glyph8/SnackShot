---
name: feature-dev
description: SnackShot 코드 변경 작업 오케스트레이터. "구현해줘", "추가해줘", "만들어줘", "수정해줘", "고쳐줘", "버그", "리팩토링", "다시 해줘", "업데이트", "보완", DB 스키마/마이그레이션/repo, 서비스 구현, 화면/컴포넌트/스토어 등 코드를 직접 변경하는 모든 SnackShot 개발 요청에 반드시 이 스킬을 사용하라. 단순 질문·설명·ADR 검토는 직접 응답해도 된다.
---

## 개요

SnackShot 개발 워크플로우 오케스트레이터.
**실행 모드:** 서브 에이전트 순차 실행 (planner → 구현 에이전트들 → qa)

레이어 의존성: **DB → Service → UI**
DB 레이어가 없으면 Service가, Service가 없으면 UI가 동작하지 않는다.

## Phase 0: 컨텍스트 확인

시작 전 `_workspace/` 디렉토리 존재 여부 확인:

| 상황 | 조치 |
|------|------|
| `_workspace/` 없음 | Phase 1부터 전체 실행 |
| `plan.md` 있음 + "이 부분만"/"다시"/"수정" | 해당 에이전트만 재실행, Phase 3(QA)은 재실행 |
| `plan.md` 있음 + 새 기능 요청 | `_workspace/`를 `_workspace_prev/`로 rename 후 Phase 1부터 |

## Phase 1: 계획 수립

```
Agent({
  subagent_type: 'planner',
  model: 'opus',
  prompt: `기능 요청: [사용자 요청 그대로 전달]

CLAUDE.md, SnackShot-ADR.md, SnackShot-ADR-Phase0.md,
src/db/schema.ts, src/types/domain.ts를 읽고
_workspace/plan.md에 구현 계획을 작성하라.`
})
```

`_workspace/plan.md` 생성 확인 후 Phase 2 진행.

## Phase 2: 구현

`plan.md`의 "필요 에이전트" 섹션을 읽고 **필요한 에이전트만** 순서대로 실행한다.

### 2-1. DB 레이어 (db-engineer 필요 시)

```
Agent({
  subagent_type: 'db-engineer',
  model: 'opus',
  prompt: `사용자 원요청: [원요청 1-2줄 요약 — plan.md에 누락된 뉘앙스 보존용]

_workspace/plan.md의 DB 레이어 태스크를 구현하라.
완료 후 _workspace/db_done.md를 작성하라.`
})
```

### 2-2. Service 레이어 (service-engineer 필요 시, DB 완료 후)

```
Agent({
  subagent_type: 'service-engineer',
  model: 'opus',
  prompt: `사용자 원요청: [원요청 1-2줄 요약]

_workspace/plan.md의 Service 레이어 태스크를 구현하라.
db-engineer가 작성한 repo 함수를 활용할 것.
완료 후 _workspace/service_done.md를 작성하라.`
})
```

### 2-3. UI 레이어 (ui-engineer 필요 시, Service 완료 후)

```
Agent({
  subagent_type: 'ui-engineer',
  model: 'opus',
  prompt: `사용자 원요청: [원요청 1-2줄 요약]

_workspace/plan.md의 UI 레이어 태스크를 구현하라.
service-engineer가 정의한 서비스 인터페이스를 활용할 것.
완료 후 _workspace/ui_done.md를 작성하라.`
})
```

## Phase 3: QA 검증

```
Agent({
  subagent_type: 'qa-engineer',
  model: 'opus',
  prompt: `_workspace/의 done 파일들을 확인하고
npx tsc --noEmit를 실행한 후 ADR 위반 grep 검사를 수행하라.
결과를 _workspace/qa_report.md에 작성하라.`
})
```

**QA 결과 처리:**
- **PASS** → Phase 4 진행
- **FAIL** → `qa_report.md`의 수정 대상 에이전트를 재호출 (1회), 이후 QA 재실행
- 재실패 시: 해당 산출물 없이 진행, 보고서에 미해결 항목 명시

## Phase 4: 완료 보고

```markdown
## 완료: [기능명]

### 변경 파일
[변경된 파일 목록]

### QA 결과: PASS

### 다음 확인 항목
- [ ] 에뮬레이터 동작 확인 (Metro reload)
- [ ] DB 변경 시: 콘솔 로그로 데이터 확인
- [ ] UI 변경 시: 에뮬레이터 시각 확인

### 하네스 개선점
[이번 실행에서 발견한 에이전트/스킬/워크플로우 개선점.
예: 에이전트 문서와 실제 코드의 불일치, QA 오탐, 반복된 시행착오.
발견 시 CLAUDE.md 변경 이력 갱신과 함께 해당 파일 수정을 제안. 없으면 "없음"]
```

## 데이터 흐름

```
사용자 요청
    ↓ planner
_workspace/plan.md
    ↓ db-engineer (선택)
_workspace/db_done.md
    ↓ service-engineer (선택)
_workspace/service_done.md
    ↓ ui-engineer (선택)
_workspace/ui_done.md
    ↓ qa-engineer
_workspace/qa_report.md
    ↓
완료 보고
```

## 에러 핸들링

- 에이전트 1회 실패: 재시도 후 2회 실패 시 해당 단계 건너뜀 + 보고서에 명시
- ADR 위반 발견 시: 해당 에이전트 즉시 재작업 요청
- TypeScript 에러: `qa_report.md` 에러 목록을 담당 에이전트에 전달하여 수정

## 테스트 시나리오

**정상 흐름:** "오늘 탭에 Entry 목록 표시 기능 구현해줘"
1. planner: DB(`getEntriesByDay` repo 추가) + UI(`today.tsx` FlatList) 계획
2. db-engineer: `getEntriesByDay()` repo 함수 구현
3. ui-engineer: `today.tsx` FlatList 렌더링 추가
4. qa-engineer: `tsc --noEmit` 통과, ADR 위반 없음 → PASS

**에러 흐름:** qa가 `deleted_at IS NULL` 누락 발견 → FAIL → db-engineer 재작업 → QA 재실행 → PASS
