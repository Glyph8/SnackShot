# SnackShot 불변식(INVARIANTS) — 기계가독 규칙표

> 등급: **규범(canonical)** · `docs/INDEX.md` 참조
> 목적: ADR 43KB 서사에서 **강제 가능한 규칙만** 증류한다. 에이전트는 작업 전 이 한 장으로 규칙을 로드하고, 근거 서사가 필요할 때만 ADR 본문을 펼친다.
> **이 표는 `.claude/agents/qa-engineer.md`의 검사 목록과 1:1로 동기화된다.** 한쪽을 고치면 다른 쪽도 고친다.

## 강제 불변식

| ID | 불변식 | 적용 범위 | 위반 1차 탐지 | 근거 |
|----|--------|-----------|----------------|------|
| INV-soft-delete | entries/decisions/outcomes 조회에 `deleted_at IS NULL` 누락 금지 | `src/db/repos/` | `grep -rn -A2 'FROM entries\|FROM decisions\|FROM outcomes' src/db/repos/` 후 WHERE 절 육안 확인 | ADR-014 |
| INV-utc-ms | 시각은 INTEGER(Unix ms, UTC). 표시 시점에만 `date-fns` 로컬 변환 | 전체 | 코드리뷰(컴파일로 못 잡음) | ADR-013 |
| INV-id-ulid | ID 생성은 `@/lib/id.ts`의 `newId()`만 | 전체 | `grep -rn 'uuid\|Math.random\|Date.now().*id' src` | ADR-009 |
| INV-ai-original | AI 원본 컬럼(`summary` 등)과 사용자 편집본(`user_*`) 컬럼 분리 유지. AI 원본 삭제/덮어쓰기 금지 | decisions/outcomes | 스키마·repo 육안 | ADR-016 |
| INV-transcript-split | Transcript는 entries와 JOIN하지 않고 별도 조회(1:N) | `src/db/repos/` | `grep -rn 'JOIN transcripts\|transcripts t' src/db/repos/` | ADR-010 |
| INV-no-class | repo/service는 함수형 객체. 클래스 금지 (단 `Error` 서브클래스는 허용) | `src/` | `grep -rn 'class ' src \| grep -v 'extends Error'` | CLAUDE.md |
| INV-no-any | `any` 타입 금지(`unknown` + 가드 사용) | `src/`, `app/` | `grep -rn ': any\b' src app` | CLAUDE.md |
| INV-async-await | `Promise.then()` 금지, async/await만 | `src/`, `app/` | `grep -rn '\.then(' src app` | CLAUDE.md |
| INV-no-expo-av | `expo-av` 금지(`expo-video`/`expo-audio`) | 전체 | `grep -rn 'expo-av' src app` | CLAUDE.md |
| INV-sqlite-async | expo-sqlite는 `*Async` API만. `*Sync`/legacy callback/`transaction(` 금지 (`withTransactionAsync`는 허용) | `src/` | `grep -rn 'getFirstSync\|getAllSync\|execSync\|runSync' src` ; `grep -rn 'transaction(' src \| grep -v 'withTransactionAsync'` | CLAUDE.md |
| INV-repo-only | UI/store에서 SQL 직접 실행 금지. 데이터 접근은 `@/db` repo 함수, 다단계 워크플로는 service 경유 | `app/`, `src/stores/` | `grep -rn 'runAsync\|getFirstAsync\|getAllAsync\|execAsync' app src/stores` | 레이어 원칙 |
| INV-zod-parse | AI 응답은 `safeParse`로 검증. 타입 단언(`as ...Response`) 금지 | `src/services/` | `grep -rn 'as Decision\|as Transcript\|as AiResponse' src/services` | ADR-021 |
| INV-token-only | 색·간격·라운드·그림자·폰트는 `@/theme` 토큰. `#RRGGBB`·매직넘버 하드코딩, `palette` 직접 import 금지 | `app/`, `src/components/` | `grep -rn '#[0-9a-fA-F]\{6\}' app src/components` ; `grep -rn "from '@/theme/tokens'" app src/components` | DesignSystem |
| INV-migration-append | 기존 마이그레이션 SQL 텍스트 수정 금지. 변경은 새 버전 추가 + `TARGET_VERSION` 증가 | `src/db/schema.ts` | 코드리뷰(이미 배포된 DB의 user_version 이력과 일치해야 함) | migrations 러너 |
| INV-enum-source | 도메인 enum의 진실원은 `src/types/enums.ts`의 `as const` 배열. 새 값은 여기 먼저 추가 후 파생(Zod/타입) 사용. 신규 CHECK는 `sqlCheck()` | `src/` | `grep -rn "z.enum(\['" src/services` (인라인 리터럴 배열 발견 시 enums.ts로 이전) | P1-2 |
| INV-file-size | 한 파일 200줄 이내 권장(경고 수준, FAIL 아님) | `src/`, `app/` | `find src app \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} + \| awk '$1>200 && $2!="total"'` | CLAUDE.md |

## 허용 예외 (위반으로 보고하지 말 것)

- **read-back SELECT**: INSERT 직후 자기 `id`로 다시 읽는 `SELECT ... WHERE id = ?`는 soft-delete 필터 불필요(방금 삽입한 row). 예: `insertEntry`.
- **CHECK 보장 단언**: DB row 값을 CHECK 제약이 보장하는 리터럴 유니온으로 좁히는 `as EntryMode`/`as ProcessingStatus` 등은 repo의 `to*()` 변환 함수 내부에 한해 허용. (P1-2 이후 `makeGuard()` 가드로 점진 대체 권장.)
- **`Error` 서브클래스**: `RescheduleError`/`CancelJobError` 등은 INV-no-class 예외.
- **멀티라인 SQL**: grep은 1차 스크리닝일 뿐. 매치가 나오면 반드시 파일을 열어 실제 위반인지 확인한 뒤 판정(오탐 FAIL 금지).
