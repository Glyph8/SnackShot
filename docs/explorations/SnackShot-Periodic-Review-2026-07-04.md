# SnackShot 정기 점검 리뷰 — 2026-07-04

상태: **점검 보고서(비규범)**. 자동 정기 점검 실행의 산출물. 제안 항목은 후속 세션에서 채택 여부 결정.

## 1. 계획 문서 구현 검증 결과

Decision-Enhancement-Guide(D1~D4)·UserFeedback-Guide(E1~E3)의 핵심 심볼 17종을 코드에서 전수 확인 — **전부 존재, 배선 정상**:
`decisions_fts`(6파일) · `searchDecisions` · `buildFtsQuery`(공용화 확인) · `learnings`(9파일 관통) · `getDecisionPerformance` · `decision_links` · `getDecisionsOnThisDay` · `followUpNotifications`(6파일) · `LOW_CONFIDENCE_THRESHOLD` · `getRecentRejectedSummaries` · `obsidian_import`(5파일) · `handleObsidianImport` · `obsidian_inbox_last_hash` · `readUserProfile` · `getRecentDecisionDigest` · `getAiContext`(4파일). `npm run verify` PASS(17 versions, v17). docs/INDEX.md의 "구현 반영" 이력 표기와 일치.

**남은 미검증 항목(에뮬레이터 필요, 다음 실기기 세션 체크리스트):**

- D3: 후속 확인 알림 실제 발화·탭 딥링크(/inbox)
- E1: vault Inbox.md 실제 읽기/비우기(파일 IO)
- E3: Gemini 요청 body에 프로필/다이제스트 실주입 확인

**발견·수정한 이슈:** `.expo/types/router.d.ts`가 32바이트로 잘려 있어(생성 중단 추정) 로컬 `npm run verify`가 typecheck에서 깨지는 상태였다. 올바른 내용으로 복구(gitignored 생성 파일, `expo start` 시 재생성됨).

## 2. AI 가독성 리팩토링 (이번 실행에서 수행)

**archive.tsx 694→535줄.** 기존 추출 패턴(상태·핸들러는 화면, 순수 렌더는 `components/<화면>/`) 그대로:

- `src/components/archive/ArchiveCalendarCard.tsx`(114줄) — ko 로케일·CALENDAR_THEME·손그림 화살표·테이프/종이말림 카드. props 주입식 순수 렌더.
- `src/components/archive/ArchiveTimelineList.tsx`(147줄) — `TimelineRow` 타입 + `buildTimelineRows`(순수 함수, 결정 인레이 병합·버킷 구분선) + 타임라인 FlatList.

JSX·로직은 바이트 수준 이동(동작 무변경 의도), verify PASS. 에뮬레이터 스모크(월/주/타임라인/검색 전환) 1회 권장.

**다음 리팩토링 후보(크기순, 같은 패턴 적용 가능):**

| 파일 | 줄 | 추출 여지 |
|------|----|----------|
| `src/db/schema.ts` | 761 | SQL 상수라 분리 실익 낮음(마이그레이션 해시락 주의). 보류 권장 |
| `app/(tabs)/settings.tsx` | 541 | Receipt/저장공간/백업 블록 → `components/settings/` 추가 추출 |
| `app/entry/[id].tsx` | 516 | Polaroid 히어로·transcript 섹션 분리 |
| `src/db/repos/decisions.ts` | 451 | 검색(FTS)·성과(performance)·다이제스트를 파일 분할 검토 |

**@codemap 미부착 8파일:** `_layout` 2종, `index`, `record`, `record-audio`, `preview`, `preview-audio`, `compose-text` — 캡처 플로우 위주. 헤더 부착 시 AI 탐색성 개선(비용 낮음).

**하네스 소견:** "화면 추출 패턴"이 6/17 이후 사실상 표준으로 작동 중이며 CLAUDE.md 폴더 컨벤션과 일치. 별도 지침 개정 불요. INVARIANTS 게이트가 이번 리팩토링에서도 회귀 차단 역할을 했다(토큰/팔레트 위반 0).

## 3. UI/UX 점검

다이어리 프리미티브 31종(`src/components/ui/`)이 주요 표면에 깊게 배선되어 있음을 확인: PostIt 6곳, Pin 10곳, Polaroid 3곳, Receipt 2곳(설정·저장공간), StampButton·Sticker·PaperScrap·HandDrawnBorder·PaperTexture·IllustrationSlot 각 1~3곳. Craft-Motion 계획이 실제로 반영된 상태.

- **미사용 표면:** `Paperclip.tsx`는 어디서도 사용되지 않음 — dead code 금지 원칙(6/16 검토 후속과 동일 잣대)에 따라 활용처 마련 또는 제거 결정 필요. 활용안은 4절 참고.
- `decisions.tsx`(딥링크 전용)·`storage-files.tsx`는 프리미티브 없음 — 유틸리티 화면이라 의도적 절제로 보이며, 과장식은 오히려 역효과. 현상 유지 권장.
- 무인 실행 원칙상 시각 변화가 생기는 UI 코드 변경은 보류(작업 흐름 규칙 3: 에뮬레이터 시각 확인 필수).

## 4. 다이어리 감성 강화 제안 (우선순위순, 전 항목 에뮬레이터 확인 필수)

1. **작성면을 괘선 위로** — `compose-decision`·`compose-text`의 TextInput은 현재 일반 입력. `TimelineMemoItem`의 "메모지 괘선 위에 글씨"(LinedPaper + 줄높이=lineGap 정렬) 패턴을 재사용해 직접 쓰는 순간을 가장 다이어리답게. 효과 대비 비용 최저(기존 패턴 이식).
2. **확정 = 도장 찍기 확대** — StampButton이 DecisionBoardCard에만 있음. EditDecisionSheet 저장·compose-decision 확정에도 적용해 "결정을 도장으로 확정"하는 일관된 은유.
3. **날짜 소인(消印) 컴포넌트** — TimelineSeparator의 월/년 레벨을 우체국 소인풍 원형 스탬프로. 타임라인 스크롤이 편지 뭉치 넘기는 느낌.
4. **Paperclip 활용** — entry 상세에서 transcript 블록을 '클립으로 집어둔 첨부'로 표현(3절 미사용 표면 해소를 겸함).
5. **신중 항목** — 손글씨 텍스트에 미세 회전/베이스라인 흔들림 추가는 가독성 훼손 위험. Highlight `vary` 시드 방식처럼 결정적(deterministic) 변주로 한정하고, 본문이 아닌 장식 요소에만.
