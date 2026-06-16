# 코드맵 — 탐색 역색인 (P3-2)

> 등급: 참고(navigation aid). 세부 시그니처의 진실원은 항상 코드다(`docs/INDEX.md`).
> 목적: AI 에이전트가 파일을 열기 전에 "무엇이 어디서 무엇을 만지는지" 빠르게 잡게 한다.

## 레이어 (단방향 의존: DB → Service → UI)

```
app/, src/components/, src/stores/   (UI)        ← repo/service만 호출, SQL 직접 금지(INV-repo-only)
        │
src/services/  (Service)  stt · label · jobs · obsidian · deleteEntry
        │
src/db/  (DB)  schema · migrations · repos/* · mapping(makeRowMapper)
        │
src/types/  enums(진실원) · domain
```

## 엔티티 → 1차 소유 repo

| 엔티티 | repo (소유) | 주요 서비스 | 주로 쓰는 화면 |
|--------|-------------|-------------|----------------|
| Entry | `src/db/repos/entries.ts` | jobs(compression/stt/label), deleteEntry, obsidian/export | today, archive, entry/[id], preview*, compose-text |
| Transcript | `src/db/repos/transcripts.ts` | stt | entry/[id], archive(검색) |
| Decision | `src/db/repos/decisions.ts` | label(추출) | inbox, entry/[id], today(배지) |
| Outcome | `src/db/repos/outcomes.ts` | jobs(outcome_followup) | inbox(FollowUp), entry/[id] |
| AiJob | `src/db/repos/aiJobs.ts` | jobs/queue·handlers | settings(export 통계) |
| Settings | `src/db/repos/settings.ts` | obsidian | settings, inbox, lib/obsidian |
| 집계(통계) | `src/db/repos/stats.ts` | — | settings |

## 화면 → 데이터 의존 (import 기준)

| 화면 (라우트) | repo(@/db) | service | store |
|---------------|-----------|---------|-------|
| `_layout` (부트스트랩) | migrations | jobs/queue(start/stop worker) | — |
| `(tabs)/today` (/today) | entries 등 | deleteEntry, jobs/queue | today |
| `(tabs)/archive` (/archive) | transcripts(searchTranscripts) | — | archive, today |
| `(tabs)/inbox` (/inbox) | settings | — | inbox |
| `(tabs)/settings` (/settings) | settings·stats·ObsidianExportStats | obsidian, jobs/queue | — |
| `entry/[id]` (/entry/:id) | entries·transcripts·decisions | deleteEntry, jobs/errors, jobs/queue | — |
| `record`·`record-audio` | — (캡처만) | — | — |
| `preview`·`preview-audio` | insertEntry·updateCompressionResult 등 | jobs/queue(kickWorker) | — |
| `compose-text` | insertTextEntry·getSettings·enqueueJob | jobs/queue(kickWorker) | — |

## 잡 파이프라인 (ADR-012)

`ai_jobs` 테이블 큐 → `services/jobs/queue.ts`(워커 폴링·재시도) → `handlers.ts`(타입별):
`compression` · `stt` · `label_extraction` · `outcome_followup` · `obsidian_export`.
잡 타입 enum 진실원: `src/types/enums.ts`(`AI_JOB_TYPE`).

## 탐색 레시피 (정확한 호출처는 grep으로)

- 특정 repo 함수 사용처: `grep -rn '함수명' app src/services src/stores`
- 특정 엔티티 만지는 곳: 해당 repo의 export를 grep
- 화면의 데이터 의존: `grep -nE "from '@/(db|services|stores)" <파일>`
