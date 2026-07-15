# 코드맵 — 탐색 역색인 (P3-2)

> 등급: 참고(navigation aid). 세부 시그니처의 진실원은 항상 코드다(`docs/INDEX.md`).
> 목적: AI 에이전트가 파일을 열기 전에 "무엇이 어디서 무엇을 만지는지" 빠르게 잡게 한다.

## 레이어 (단방향 의존: DB → Service → UI)

```
app/, src/components/, src/stores/   (UI)        ← repo/service만 호출, SQL 직접 금지(INV-repo-only)
        │
src/services/  (Service)  stt · label · jobs · obsidian · video · widget
                          단일경로: saveCapturedEntry · saveAuthoredDecision · textRevision · deleteEntry · revertDecisionToTodo
        │
src/db/  (DB)  schema · migrations · repos/* · mapping(makeRowMapper)
        │
src/types/  enums(진실원) · domain
```

## 엔티티 → 1차 소유 repo

| 엔티티 | repo (소유) | 주요 서비스 | 주로 쓰는 화면 |
|--------|-------------|-------------|----------------|
| Entry | `src/db/repos/entries.ts` | jobs(compression/stt/label/original_backup), saveCapturedEntry, deleteEntry, obsidian/export, video(sweep·exportMonthZip) | today, archive, entry/[id], preview*, compose-text, storage, storage-files |
| Transcript | `src/db/repos/transcripts.ts` | stt | entry/[id], archive(검색) |
| Decision | `src/db/repos/decisions.ts` | label(추출·compose), saveAuthoredDecision, revertDecisionToTodo, widget/widgetSync | inbox, entry/[id], decision/[id], today(배지), compose-decision, decisions |
| TextRevision | `src/db/repos/textRevisions.ts` | textRevision(SoT — 수동수정/AI재작성/복원 단일 경로) | entry/[id], EditDecisionSheet 사용처(inbox·archive 등) |
| Outcome | `src/db/repos/outcomes.ts` | jobs(outcome_followup) | inbox(FollowUp), entry/[id], decision/[id](회고 타임라인·getOutcomeHistory) |
| AiJob | `src/db/repos/aiJobs.ts` | jobs/queue·handlers | settings(export 통계) |
| Settings | `src/db/repos/settings.ts` | obsidian | settings, inbox, lib/obsidian |
| 집계(통계) | `src/db/repos/stats.ts` | — | settings |

## 화면 → 데이터 의존 (import 기준)

| 화면 (라우트) | repo(@/db) | service | store |
|---------------|-----------|---------|-------|
| `_layout` (부트스트랩) | migrations | jobs/queue(start/stop worker), widget/widgetSync | — |
| `(tabs)/today` (/today) | entries 등 | deleteEntry, jobs/queue | today |
| `(tabs)/archive` (/archive) | transcripts(searchTranscripts) | — | archive, today |
| `(tabs)/inbox` (/inbox) | getSettings·searchDecisions·insertDecisionLink | — | inbox | (처리 전용: 덱+후속 도래+마감 도래 미결)
| `(tabs)/decisions` (/decisions) | stats·decisions·outcomes | — | inbox(공유) | (통계+보드 이관+전체기록, DecisionBoard/DecisionList)
| `settings` (/settings, 스택) | settings·stats·ObsidianExportStats | obsidian, jobs/queue, video/sweep | — | (Today ⚙로 진입, 탭에서 이동)
| `entry/[id]` (/entry/:id) | entries·transcripts·decisions | deleteEntry, jobs/errors, jobs/queue | — |
| `decision/[id]` (/decision/:id) | decisions·outcomes(getOutcomeHistory)·decisionLinks·entries | followUpNotifications, jobs/queue | inbox(미결 전이) |
| `record`·`record-audio` | — (캡처만) | media-library(인앱 갤러리 열람) | — |
| `preview`·`preview-audio` | (services 경유) | saveCapturedEntry → jobs/queue | — |
| `compose-text` | insertTextEntry·getSettings·enqueueJob | jobs/queue(kickWorker) | — |
| `compose-decision` (/compose-decision) | getSettings·addCustomCategory | saveAuthoredDecision, label(composeDecision) | — |
| `storage` (/storage) | getAllMediaEntries | video/exportMonthZip | — |
| `storage-files` (/storage-files) | getAllMediaEntries·getSettings·enqueueJob·markOriginalPurged | jobs/queue(kickWorker) | — |
| `(tabs)/invest` (/invest) | portfolio·decisions(getTradeDecisionRows) | trade/{valuation,principleWatch}, obsidian(readUserProfile), quotes | — |
| `stock/[ticker]` (/stock/:ticker) | decisions(getTradeDecisionRows)·outcomes | quotes(getDailyCandles), trade/schema | — |
| `portfolio-import` (/portfolio-import) | insertPortfolioSnapshot | trade/{portfolio,principleWatch}, label(parsePortfolioImage) | — |

## 잡 파이프라인 (ADR-012)

`ai_jobs` 테이블 큐 → `services/jobs/queue.ts`(워커 폴링·재시도) → `handlers/`(타입별 파일):
`compression` · `stt` · `label_extraction` · `outcome_followup` · `obsidian_export` · `original_backup`.
잡 타입 enum 진실원: `src/types/enums.ts`(`AI_JOB_TYPE`).
자동 스윕(`services/video/sweep.ts`)이 설정 기준으로 compression/original_backup 잡을 enqueue한다.
`compression` 핸들러는 영상(`Video.compress`)·사진(`Image.compress`, v18 `mode='photo'`)을 모두 다단계 처리한다.

## 탐색 레시피 (정확한 호출처는 grep으로)

- 특정 repo 함수 사용처: `grep -rn '함수명' app src/services src/stores`
- 특정 엔티티 만지는 곳: 해당 repo의 export를 grep
- 화면의 데이터 의존: `grep -nE "from '@/(db|services|stores)" <파일>`
