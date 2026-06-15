# Today 목록 드래그 재정렬 — 영향 분석 (구현 전 조사)

> 목적: "Today 목록 보기에서 드래그로 Entry 순서 변경" 기능을 넣기 위해 **수정해야 할 부분과 파급효과**를 정리한다. (구현 X)

## 1. 현재 정렬 모델

- `entries` 테이블에 **정렬 전용 컬럼이 없다.** 순서는 전적으로 `recorded_at`(UTC ms)으로 결정된다.
  - 인덱스: `idx_entries_recorded_at`.
- 쿼리: `getEntriesByDay()` → `ORDER BY recorded_at DESC`.
- 화면별로 정렬을 다시 만지고 있어 **이미 일관적이지 않다**:
  - `app/(tabs)/today.tsx`: 로드 후 `recordedAt` **오름차순** 재정렬(최신이 아래).
  - `src/services/jobs/handlers.ts`(옵시디언 export): `recordedAt` **오름차순** 정렬.
  - `src/stores/archive.ts`(선택일): `getEntriesByDay` 결과(**내림차순**) 그대로.
- 관련 결정: **ADR-003** — "클립이 1급 객체, Day는 *시간순* 그룹화 뷰" + 예시 쿼리 `ORDER BY recorded_at ASC`. **ADR-013** — 시각은 UTC ms.
- 마이그레이션: `TARGET_VERSION = 7` (PRAGMA user_version 기반).

→ 핵심: 지금 "순서 = 시간"이 **암묵적 불변식**이라, 수동 순서는 새로운 1급 개념을 도입하는 변경이다.

## 2. ADR 충돌 (가장 먼저 결정할 것)

수동 재정렬은 ADR-003의 "Day는 시간순 뷰"와 직접 충돌한다. 구현 전 **ADR 개정/신규 결정**이 필요하다:
- ADR-003 개정 또는 신규 ADR: "Entry는 사용자 지정 순서(`sort_order`)를 가질 수 있고, 기본값은 recorded_at에서 파생한다."
- CLAUDE.md "절대 금지: ADR 결정 임의 변경 — 질문 후 ADR 갱신" 규칙에 따라 **선결 항목**.

## 3. 결정해야 할 설계 질문

1. **재정렬 범위**: 하루 안에서만(권장 — 데이터가 day 단위로 그룹화됨) vs 전체. 날짜 경계는 `dayBoundaryHour` 기준 "논리적 하루".
2. **재정렬의 적용 범위(가장 중요)**: 순서를 DB에 저장하면 **목록 보기뿐 아니라 일기 보기·Archive·옵시디언 export 전부**에 반영된다.
   - (A) *전역 순서*(권장): 한 곳에서 바꾸면 모든 뷰가 동일 순서. 단순·일관적.
   - (B) *목록 보기 전용 표시 순서*: list view에서만 다르게 — 별도 표시 상태가 필요하고 다른 뷰와 어긋나 혼란. 비권장.
3. **옵시디언 export 순서**: 데일리 노트를 사용자 순서로 재생성할지, 아니면 vault는 시간순 유지할지. 후자면 앱↔vault 순서가 갈린다. (사용자 순서 반영 권장)
4. **신규/외부 추가 Entry의 위치**: 인라인 메모·업로드·녹화로 들어온 새 Entry는 기본적으로 맨 끝(최신)으로. recorded_at 파생 기본값이면 자연히 해결.

## 4. DB 레이어 변경 (`src/db/`)

- **마이그레이션 v8** 추가(`schema.ts` `MIGRATIONS`, `TARGET_VERSION`=8):
  - `ALTER TABLE entries ADD COLUMN sort_order REAL`(또는 INTEGER).
  - 기존 행 백필: `UPDATE entries SET sort_order = recorded_at`.
  - SQLite는 "다른 컬럼을 DEFAULT"로 못 쓰므로 **insert 시 코드에서 `sort_order = recorded_at` 명시**.
  - (선택) 인덱스 `idx_entries_sort_order`.
- **repo 변경**(`repos/entries.ts`):
  - `getEntriesByDay` 등 정렬을 `ORDER BY sort_order ASC`로(또는 `COALESCE(sort_order, recorded_at)`).
  - `insertEntry`/`insertTextEntry`에 `sort_order` 기록(기본 = recorded_at).
  - 신규: `reorderEntriesForDay(db, orderedIds: string[])` — 한 트랜잭션에서 각 id의 `sort_order`를 새 값으로 일괄 UPDATE.
  - 타입(`src/types/domain.ts`) `Entry`에 `sortOrder: number` 추가(snake→camel 매핑).
- **순서 값 전략**: 정수 재번호(0,1,2…)는 단순하지만 매 재정렬마다 그날 전체 UPDATE. REAL(이웃 평균값 삽입)은 드물게 재번호 필요. 하루 항목 수가 적으므로 **정수 재번호 + 그날 일괄 UPDATE가 단순·안전**.

## 5. 서비스/Export 레이어 (`src/services/`)

- `jobs/handlers.ts` 옵시디언 export의 `items.sort((a,b)=>recordedAt)`를 **`sort_order` 기준**으로 변경(결정 3에 따름).
- export는 "그날 전체 재생성"이라, 순서 변경 후 **해당 날 `obsidian_export` 잡 재큐잉** 필요(이미 편집 시 재큐잉 패턴 존재 — 재사용).
- `exported_at` 무효화(`clearExportedAt`)도 동일 패턴으로.

## 6. UI/상태 레이어

- **대상 화면**: `app/(tabs)/today.tsx`의 **list 뷰(EntryCard)**. diary 뷰는 큰 폴라로이드라 드래그 UX가 부적합 → list 뷰에서만 드래그 제공하되 **저장 순서는 공유**(결정 2A).
- **today.tsx**: 현재 `recordedAt` 재정렬 라인 제거, `sort_order` 순서 사용. FlatList → 드래그 지원 리스트로 교체(아래 라이브러리).
- **로컬 갱신**: 드래그 종료 시 새 순서로 즉시 setState + `reorderEntriesForDay` 호출 + 잡 재큐잉. 폴링(`load()`)과의 경쟁 주의(드래그 중 재로드가 순서를 덮어쓰지 않도록 가드).
- **Archive**: 선택일 목록/`MomentsRow`도 `sort_order` 순서로 통일(정렬 일관화).
- **드래그 핸들/모드**: list 뷰에서 long-press 드래그 또는 전용 핸들. 편집/삭제 제스처와 충돌하지 않게.

## 7. 라이브러리 & 의존성 리스크

- 사실상 표준: **`react-native-draggable-flatlist`** — 내부적으로 **reanimated(워클릿) + gesture-handler** 필요.
  - gesture-handler는 이미 사용 중(녹화 핀치). reanimated는 폰트 도입과 무관하게 **워클릿 babel 설정이 실제로 동작하는지 미검증**(과거 DecisionDeck은 이 불확실성 때문에 코어 `Animated`+`PanResponder`로 우회함).
  - 따라서 **선결 검증**: reanimated 워클릿이 이 빌드에서 동작하는지 확인 후 도입. 안 되면 (a) babel 설정 정비, 또는 (b) 코어 API 기반 수동 드래그 구현(난도 높음).
- 설치는 현재 샌드박스 네트워크 차단 → 사용자가 `npx expo install react-native-draggable-flatlist` 실행 필요. 네이티브 추가 모듈은 없지만 reanimated 의존이 핵심.

## 8. 엣지 케이스 / 주의

- **Soft delete**(ADR-014): 재정렬은 `deleted_at IS NULL`만 대상. 삭제된 항목 사이 빈 순서값 무방(재번호로 정리).
- **dayBoundaryHour**: 재정렬 범위는 "논리적 하루". export 키와 동일 규칙 사용.
- **여러 날에 걸친 작업**: Today는 단일 날짜 뷰라 문제 없음. 전역 리스트(`getEntriesPage`, 검색)는 재정렬 비대상 — `sort_order`가 같은 하루 안에서만 의미 있도록 정의.
- **검색 결과**(Archive)·`getAllEntryIds`(bulk export): recorded_at 정렬 유지 가능(전체 정렬은 시간 기준이 자연스러움). → `sort_order`는 "하루 내 표시 순서"로 한정 정의하는 게 깔끔.
- **신규 항목 삽입 위치**: recorded_at 파생 기본값이면 항상 끝(최신). 사용자가 끌어올린 항목 위로 새 항목이 끼지 않게 정수 재번호 시 "최대값+1" 부여 고려.
- **동시성**: 드래그 저장 vs Today 3초 폴링/포커스 재로드 경쟁. 저장 중 플래그로 재로드 무시 필요.

## 9. 변경 파일 요약 (예상)

| 레이어 | 파일 | 변경 |
|--------|------|------|
| ADR | `SnackShot-ADR.md` | ADR-003 개정/신규 결정 |
| DB | `src/db/schema.ts` | v8 마이그레이션(sort_order 추가·백필), TARGET_VERSION |
| DB | `src/db/repos/entries.ts` | ORDER BY 변경, insert에 sort_order, `reorderEntriesForDay` |
| 타입 | `src/types/domain.ts` | `Entry.sortOrder` |
| 서비스 | `src/services/jobs/handlers.ts` | export 정렬 기준, 잡 재큐잉 |
| UI | `app/(tabs)/today.tsx` | 드래그 리스트, 저장 연동, 폴링 가드 |
| UI | `src/stores/archive.ts` / 관련 | 정렬 일관화 |
| 의존성 | `package.json` | `react-native-draggable-flatlist`(+reanimated 검증) |

## 10. 권장 진행 순서 (구현 시)

1. **ADR 결정** 확정(범위·export 반영 여부).
2. reanimated 워클릿 동작 **검증**(드래그 라이브러리 전제).
3. DB v8(sort_order) + repo(`reorderEntriesForDay`) + 타입.
4. 옵시디언 export 정렬 기준 반영 + 재큐잉.
5. Today list 뷰 드래그 + 저장 + 폴링 가드.
6. Archive/기타 뷰 정렬 일관화.
7. QA: tsc, 마이그레이션 로그 확인, 재정렬→export 결과 확인.

## 미해결 질문 (사용자 결정 필요)

- 재정렬을 **전역 순서**로 둘까(모든 뷰·옵시디언 반영), 아니면 목록 보기 표시용으로만?
- 옵시디언 데일리 노트도 **사용자 순서**로 재생성할까, vault는 시간순 유지할까?
- 드래그 진입 방식: long-press vs 전용 핸들(편집 모드에서만)?
