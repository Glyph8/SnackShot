# Phase 6 — AI 라벨링 + Decision Inbox 구현 프롬프트

> 각 Step을 순서대로 Claude Code(Opus)에 붙여넣는다. Step 사이에 에뮬레이터 검증 필수.
> 이 파일의 프롬프트는 2026-06-11 코드베이스 기준으로 작성됨 — 외부 자문 문서와 달리
> 실제 파일명·ADR 번호·기구현 범위를 반영했다.
>
> **이미 완료되어 있는 것 (Step 프롬프트가 전제하는 상태):**
> - `src/services/label/prompts.ts` — 시스템 프롬프트 + few-shot + 사용자 메시지 빌더 (ADR-027, 수정 금지·사용만)
> - ADR-027 — 프롬프트 정책, 3중 환각 방어, 응답 스키마 범위
> - `src/lib/env.ts`의 `getGeminiKey()/setGeminiKey()/deleteGeminiKey()`
> - decisions/outcomes 테이블(v1)과 repo 함수 대부분 (`insertDecision`, `getPendingDecisions`,
>   `getDecisionsDueForFollowUp`, `updateDecisionStatus`, `updateUserEdit`, `insertOutcome` 등)
> - `ai_jobs`의 `label_extraction` 잡 타입 (v1 CHECK에 이미 포함 — **마이그레이션 불필요**)
> - `entries.ai_label_status` — stt_status 분리(v4) 이후 라벨링 전용으로 비어 있음

---

## Step 1 — Label 서비스 + Gemini 구현

```
Phase 6 Step 1을 구현해줘: src/services/label/ 모듈 (Gemini 2.5 Flash-Lite 결정 추출).

전제: src/services/label/prompts.ts가 이미 존재한다 (ADR-027). 수정하지 말고 import해서 사용.
ADR-006(좁은 기준), ADR-008(Flash-Lite), ADR-021(Zod), ADR-023(키 관리), ADR-027을 먼저 읽을 것.

작업:
1. src/services/label/types.ts — stt/ 패턴(I 접두사 없는 인터페이스 + 함수형 객체):
   - ExtractHints { userDecisionHint: boolean; recordedAtIso: string; durationSec: number }
   - DecisionCandidate { summary, category(DecisionCategory), reasoning, alternatives,
     expectedOutcome, evidence, confidence, followUpAfterDays: number | null }
   - LabelResult { hasDecision: boolean; candidates: DecisionCandidate[] }
   - LabelService { extractDecisions(transcript, hints): Promise<LabelResult>; getEngineInfo() }

2. src/services/label/schema.ts:
   - Zod 스키마 (ADR-027의 응답 구조와 1:1): hasDecision, decisions[...]
     category는 z.enum(['investment','relationship','career','daily','other']),
     confidence는 z.number().min(0).max(1), followUpAfterDays는 z.number().int().positive().nullable()
   - RESPONSE_JSON_SCHEMA 상수 — Gemini responseSchema용 (OpenAPI subset: type/properties/
     required/items/enum/nullable). Zod 스키마와 필드·제약이 어긋나지 않게 나란히 정의하고
     "둘은 1:1 대응, 한쪽 수정 시 다른 쪽도" 주석.

3. src/services/label/gemini.ts — whisper.ts의 구조(타임아웃 AbortController, assertOk
   한국어 에러 메시지, 함수형 객체 export)를 그대로 따른다:
   - 엔드포인트: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent
   - 인증: 'x-goog-api-key' 헤더에 getGeminiKey() (키 없으면 명확한 한국어 에러 throw)
   - 요청 body:
     {
       systemInstruction: { parts: [{ text: DECISION_EXTRACTION_SYSTEM_PROMPT }] },
       contents: [
         ...FEW_SHOT_EXAMPLES를 user/model 턴 쌍으로 펼침
         ({ role: 'user', parts: [{ text: ex.user }] }, { role: 'model', parts: [{ text: ex.model }] }),
         { role: 'user', parts: [{ text: buildUserMessage(transcript, hints) }] },
       ],
       generationConfig: {
         responseMimeType: 'application/json',
         responseSchema: RESPONSE_JSON_SCHEMA,
         temperature: 0.2,
       },
     }
   - 응답: candidates[0].content.parts[0].text를 JSON.parse → Zod safeParse.
     파싱 실패 시 temperature 0.4로 1회 재시도, 재실패 시 throw (ADR-027 5번).
   - evidence verbatim 검증 (ADR-027 2번): transcript.includes(evidence)가 false인 후보는
     배열에서 제거하고 console.warn으로 폐기 로그. 제거 후 후보가 0개면 hasDecision=false 취급.
   - 비용 가시화: usageMetadata.promptTokenCount / candidatesTokenCount를 콘솔 로그
     (whisper.ts의 비용 로그 스타일).
   - 에러: 401 키 문제 / 429 한도(메시지에 '429' 포함 — queue.ts의 is429 재시도 로직이 잡음)
     / 5xx 서버 오류. 타임아웃 30초.

4. src/services/label/index.ts — getLabelService() 팩토리 (stt/index.ts 패턴, 현재 gemini 고정).

5. app/(tabs)/settings.tsx에 Gemini API 키 입력 추가 — 기존 OpenAI 키 입력과 동일한
   패턴/UI로. setGeminiKey/deleteGeminiKey 사용.

함정:
- expo-sqlite/DB는 이 Step에서 건드릴 것 없음. 마이그레이션 금지.
- FEW_SHOT_EXAMPLES의 model 값은 이미 JSON 문자열이다 — 다시 stringify하지 말 것.
- Gemini 2.0 모델로 바꾸지 말 것 (2026-06-01 서비스 종료됨, ADR-008/027).

검증: __DEV__ 임시 코드로 결정 있는/없는 한국어 전사 각 1개를 호출해 콘솔 확인 후 제거.
```

---

## Step 2 — handleLabelExtraction 잡 핸들러 + 큐 연결

```
Phase 6 Step 2를 구현해줘: label_extraction 백그라운드 잡 처리.

전제: Step 1 완료 (getLabelService 사용 가능). ADR-006/007/016/017 먼저 읽을 것.
현재 queue.ts의 dispatch에 'label_extraction' → "skip — not yet implemented" 케이스가 있다.

작업:
1. src/services/jobs/handlers.ts에 handleLabelExtraction(job, db):
   a. entry 로드. 없으면 throw.
   b. 라벨링 입력 텍스트 결정:
      - voice/audio: getLatestTranscript → editedText ?? rawText.
        transcript 없으면 RescheduleError(5분, 'STT 대기 중') — STT가 끝나야 함.
      - silent: manualNote 있으면 그것, 없으면 updateAiLabelStatus 'skipped' 후 종료.
   c. updateAiLabelStatus 'processing' → getLabelService().extractDecisions(text, {
        userDecisionHint: entry.userDecisionHint,
        recordedAtIso: ISO 문자열(로컬), durationSec: entry.durationMs/1000 })
   d. 후보마다 insertDecision — status='extracted', AI 원본 컬럼에 그대로(ADR-016),
      followUpAt = followUpAfterDays != null ? entry.recordedAt + followUpAfterDays * 86_400_000 : undefined,
      followUpSetBy='ai' (ADR-017), aiEngine = getEngineInfo().name.
      ⚠️ 절대 'confirmed'로 넣지 말 것 (ADR-006 — 자동 컨펌 금지).
   e. updateAiLabelStatus 'done' (후보 0개여도 done).
2. queue.ts:
   - dispatch의 'label_extraction' skip 케이스를 handleLabelExtraction 호출로 교체
   - markEntryFailed에 label_extraction 분기 추가: updateAiLabelStatus(db, targetId, 'failed')
   - STT 잡 성공 후 자동 큐잉: maybeQueueObsidianExport와 같은 자리에
     maybeQueueLabelExtraction 추가 — stt_status가 done 또는 skipped(silent)일 때,
     getGeminiKey()가 null이면 큐잉하지 않음(키 없는데 잡 쌓여 실패 누적되는 것 방지, 로그만).
3. silent entry의 메모가 나중에 작성되는 케이스: entry 상세(app/entry/[id].tsx)의
   manualNote 저장 시 — entry.mode==='silent' && aiLabelStatus가 'skipped'|'pending'이면
   label_extraction enqueue + kickWorker.
4. Today 화면 진입용 가벼운 배지 데이터: decisions repo에
   countExtractedDecisions(db): Promise<number> 추가 (status='extracted', deleted_at IS NULL).
   UI 표시는 Step 3에서.

함정:
- ai_label_status는 stt_status 분리(v4) 이후 라벨링 전용이다. stt 관련 코드를 건드리지 말 것.
- 마이그레이션 불필요 — label_extraction은 v1 CHECK에 이미 있다. TARGET_VERSION 올리지 말 것.
- 429 재시도는 queue.ts의 기존 is429/rateLimitDelay가 처리한다 — 핸들러에서 자체 재시도 금지.

검증: 결정성 발언이 든 클립 녹화 → STT → label 잡 로그 → sqlite에서
decisions row(status='extracted', follow_up_at 계산값) 확인.
```

---

## Step 3 — Decision Inbox UI

```
Phase 6 Step 3을 구현해줘: Decision Inbox 탭 (이 Phase의 핵심 UI).

전제: Step 2 완료 (extracted 후보가 DB에 쌓임). ADR-006/016/017 먼저 읽을 것.
app/(tabs)/inbox.tsx는 현재 빈 화면. decisions/outcomes repo 함수가 이미 존재한다 —
새로 만들기 전에 src/db/repos/decisions.ts, outcomes.ts를 읽고 재사용하라.

⚠️ 핵심 함정: decisions.outcome_id 컬럼은 마이그레이션 v6에서 제거됐다.
결정↔결과 연결은 outcomes.decision_id 단방향이 유일하다. "후속 확인 대기" 판정은
confirmed/edited && follow_up_at <= now && outcomes에 decision_id row 없음 —
기존 getDecisionsDueForFollowUp이 이 조건인지 확인하고 아니면 수정.

작업:
1. src/stores/inbox.ts (zustand, archive.ts 패턴 — db 파라미터 전달):
   - pendingCandidates: {decision, entry}[] (extracted), dueFollowUps: {decision, entry}[]
   - loadInbox / confirmDecision(id, edits?) / rejectDecision(id) / recordOutcome(decisionId, result)
   - 처리 후 optimistic 제거 + 재로드
2. src/components/DecisionCard.tsx:
   - 카테고리 뱃지(색상 구분), 요약(user_summary ?? summary — ADR-016 COALESCE 패턴),
     근거 인용(evidence, italic), 신뢰도 바(0.7+ 초록 / 0.5~0.7 노랑 / 미만 빨강)
   - 버튼 3개: 결정 아님(reject) / 수정 / 컨펌
   - 수정: 시트/모달에서 summary·category·followUpAt 편집 → updateUserEdit
     (user_* 컬럼만, AI 원본 보존 — ADR-016. followUpAt 수정 시 followUpSetBy='user' — ADR-017)
3. src/components/FollowUpCard.tsx:
   - 결정 요약 + "결과가 어땠어요?" + 버튼 4개: 좋았음(good) / 아쉬움(bad) /
     기억 안 남(skipped) / 영상으로 ▸
   - 앞 3개: insertOutcome(result만) 후 카드 dismiss
   - 영상으로: router.push('/record?decisionId=' + id) — record.tsx에서
     useLocalSearchParams로 받아 저장 완료 시 insertOutcome({decisionId, entryId: 새 entry.id,
     result: 'unclear'}) 연결. 새 entry는 일반 다이어리 entry로도 그대로 존재(이중 정체성).
4. app/(tabs)/inbox.tsx:
   - 헤더: "검토 대기 N건 · 후속 확인 M건", 섹션 2개, 빈 상태 문구, useFocusEffect 재로드
5. 탭 배지: (tabs)/_layout.tsx에서 Inbox 탭에 대기 건수 dot/카운트 —
   countExtractedDecisions(Step 2에서 추가됨) + due 카운트.

함정:
- 모든 decisions 쿼리에 deleted_at IS NULL (ADR-014).
- 컴포넌트 200줄 권장 — 수정 시트가 커지면 별도 파일로.
- record.tsx의 decisionId 컨텍스트는 화면 이탈 시 정리(중복 연결 방지).

검증: extracted 후보 컨펌/거절/수정 각 1회 → DB 상태 확인.
follow_up_at을 과거로 UPDATE해서 후속 확인 카드 노출 + 결과 입력 → outcomes row 확인.
```

---

## Step 4 — Decision/Outcome을 옵시디언 export에 반영

```
Phase 6 Step 4를 구현해줘: 확정된 결정과 결과를 옵시디언 데일리 노트에 callout으로 표시.

전제: Step 3 완료. ADR-016/026 먼저 읽을 것.
현재 export 구조: src/services/obsidian/export.ts의 exportDay가 DayExportItem
{entry, transcript}[]를 받아 하루 노트를 통째로 재생성한다(멱등). renderer.ts 같은
별도 파일은 없다 — buildEntrySection을 보강하는 방식으로 작업하라.

작업:
1. types.ts의 DayExportItem에 decisions: Decision[] 추가 (해당 entry의 confirmed/edited만).
   outcome 표시용으로 decisionOutcomes: Map<string, Outcome> 또는 decisions에 outcome을
   동반하는 형태 중 단순한 쪽 선택.
2. handlers.ts의 handleObsidianExport에서 day entries 수집 시 entry별
   getDecisionsByEntry 로드 → confirmed/edited 필터 → 각 decision의 outcome을
   getOutcomeByDecision으로 로드해 함께 전달.
3. export.ts buildEntrySection 보강 — 트랜스크립트/메모 뒤에 결정 callout:
   > [!decision] {user_summary ?? summary} ({카테고리 한글명})
   > **근거**: {evidence}
   > **후속 확인**: {followUpAt을 yyyy-MM-dd로}     ← followUpAt 있을 때만
   outcome이 있으면:
   > **결과 ({outcome.createdAt yyyy-MM-dd})**: {결과 한글 라벨}. {reflection 있으면}
   - rejected/extracted/soft-deleted는 절대 포함하지 않음 (ADR-006/014)
   - 표시값은 항상 user_* 우선 (ADR-016)
4. export 재큐잉 트리거 — inbox store의 confirm/edit/recordOutcome 성공 직후:
   - 해당 decision의 entry가 속한 날로 obsidian_export enqueue + kickWorker
   - outcome에 entryId(결과 영상)가 있으면 그 entry의 날도 enqueue (다른 날일 수 있음)
   - vault 미연결이면 조용히 skip
5. Inbox의 confirmed 카드(또는 처리 직후 토스트)에 "옵시디언에서 열기" 보조 액션 —
   app/entry/[id].tsx의 handleOpenInObsidian과 같은 obsidian://open 패턴 재사용
   (가능하면 공용 헬퍼로 추출).

함정:
- exportDay는 전체 재생성 멱등 방식 유지 — callout을 append하는 코드를 짜지 말 것.
- callout 내부 텍스트의 줄바꿈은 각 줄을 '> '로 시작해야 옵시디언이 callout으로 묶는다.
- bulkExport.ts는 건드릴 필요 없음 (날짜 단위 재생성에 자동 포함됨).

검증: 결정 컨펌 → vault 데일리 노트에 callout 등장 → 결과 입력 → 결과 줄 추가 확인.
adb로 md를 cat한 뒤, adb pull로 데스크탑 옵시디언에서 callout 렌더링 확인
(스타일이 마음에 안 들면 [!note]/표 형식으로 바꿔도 됨 — 형식은 취향 영역).
```

---

## 사용 메모

- 각 Step은 자기완결적 — 새 세션에서 실행해도 된다 (feature-dev 하네스가 자동 트리거됨).
- Step 1 후 `prompts.ts`를 본인이 직접 30분 다듬는 것을 권장 (ADR-027 — "결정"의 정의는
  본인 데이터에 맞아야 함). 수정해도 Step 2~4와 충돌 없음.
- 시작 전 준비물: Gemini API 키 발급 → 설정 화면(Step 1 이후) 또는 .env의
  EXPO_PUBLIC_DEV_GEMINI_API_KEY.
