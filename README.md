# SnackShot — 동영상 다이어리

> 말하면 남는, 결정을 기록하는 영상 일기.
> 짧은 영상·음성·텍스트로 하루의 순간을 남기면, AI가 말 속의 **결정(decision)** 을 뽑아내 정리하고 결과까지 추적한다.

본인 사용 목적의 개인 도구이며, AI 어시스턴트와의 페어 코딩(바이브 코딩)으로 개발 중이다.
모든 주요 의사결정은 [`SnackShot-ADR.md`](./SnackShot-ADR.md) · [`SnackShot-ADR-Phase0.md`](./SnackShot-ADR-Phase0.md)에 STAR 기법으로 기록되어 있다.

---

## 무엇을 하는 앱인가

종이 다이어리의 따뜻한 질감을 그대로 화면으로 옮긴 모바일 일기다. 핵심 흐름은 다음과 같다.

1. **캡처** — 최대 3분짜리 영상, 음성, 또는 텍스트로 순간을 기록한다.
2. **전사(STT)** — 음성을 텍스트로 변환한다. 한국어 정확도를 우선한다.
3. **AI 라벨링** — 전사된 내용에서 "내가 무슨 결정을 했는지"를 AI가 추출한다(요약·근거·대안·예상 결과·신뢰도).
4. **컨펌(Inbox)** — AI가 추출한 결정을 사용자가 확인·수정·반려한다. AI 원본과 사용자 편집본은 따로 보존된다.
5. **회고(Outcome)** — 후속 확인 시점에 결정의 실제 결과(좋음/나쁨/혼합 등)와 배운 점을 남긴다.
6. **내보내기** — 확정된 기록을 Obsidian 볼트로 내보낸다.

클립은 단순한 미디어가 아니라 **1급 객체**다(ADR-003). 날짜(Day)는 클립을 시간순으로 묶어 보여주는 뷰일 뿐이다.

---

## 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | React Native 0.83 + Expo SDK 55 (Dev Client, New Architecture) |
| 언어 | TypeScript (strict) |
| 라우팅 | expo-router (파일 기반, Next.js app router 유사) |
| 상태관리 | Zustand |
| 로컬 DB | expo-sqlite (`openDatabaseAsync` API만 사용) |
| 검증 | Zod |
| ID | ULID |
| 시간 | date-fns |
| STT | Whisper API (추상화 레이어 뒤, 교체 가능) |
| AI 라벨링 | Gemini Flash-Lite (추상화 레이어 뒤, 교체 가능) |

> ⚠️ **Expo SDK 55는 학습 데이터보다 최신이다.** 네이티브 모듈 API는 [버전 문서](https://docs.expo.dev/versions/v55.0.0/)를 반드시 확인할 것. 예: `expo-file-system`은 File/Directory 클래스 기반 동기 API로 전면 교체되어 구 `*Async` API는 런타임에서 throw한다.

---

## 아키텍처

단방향 의존 구조로, UI는 SQL을 직접 만지지 않는다.

```
app/, src/components/, src/stores/   (UI)   ← repo/service만 호출 (SQL 직접 금지)
        │
src/services/  (Service)   stt · label · jobs · obsidian · saveCapturedEntry · deleteEntry
        │
src/db/  (DB)   schema · migrations · repos/* · mapping(makeRowMapper)
        │
src/types/   enums(진실원) · domain
```

핵심 도메인 엔티티는 `Entry`(클립), `Transcript`(전사, 1:N), `Decision`(추출된 결정), `Outcome`(결정의 결과), `AiJob`(백그라운드 큐).

백그라운드 작업(압축·STT·라벨 추출·후속 확인·Obsidian 내보내기)은 모두 **DB 기반 잡 큐**(`ai_jobs` 테이블)로 처리된다(ADR-012). `services/jobs/queue.ts` 워커가 폴링·재시도하고, 타입별 핸들러가 `services/jobs/handlers/`에 분리되어 있다.

---

## 설계 원칙 (ADR 요약)

1. **클립이 1급 객체** (ADR-003) — Day는 시간순 그룹화 뷰.
2. **시각은 UTC Unix ms (INTEGER)** (ADR-013) — UI 표시 시에만 로컬 변환.
3. **Soft delete** (ADR-014) — 모든 쿼리에 `WHERE deleted_at IS NULL`.
4. **ID는 ULID** (ADR-009) — `@/lib/id.ts`의 `newId()`.
5. **DB는 snake_case ↔ TS 객체는 camelCase** — 변환은 repo 안에서.
6. **AI 원본 보존** (ADR-016) — 사용자 편집본은 별도 컬럼.
7. **Transcript는 별도 테이블** (ADR-010) — Entry와 1:N.
8. **STT/AI 라벨링은 인터페이스로 추상화** (ADR-002, ADR-008) — 구현체 교체 자유.

---

## 폴더 구조

```
app/                    expo-router 화면
  (tabs)/               today · archive · inbox · settings
  record · preview      영상 캡처/미리보기
  record-audio · …      음성 캡처/미리보기
  compose-text          텍스트 입력
  entry/[id]            클립 상세
src/
  db/                   schema · migrations · repos · mapping
  services/             stt · label · jobs · obsidian · saveCapturedEntry · deleteEntry
  stores/               zustand (today · archive · inbox)
  components/           재사용 UI (archive/ entry/ settings/ today/ ui/)
  theme/                디자인 토큰 (색·타이포·간격·그림자·모션)
  types/                도메인 타입 · enum 진실원
  lib/                  id · time · obsidian · storage · env
docs/                   INDEX(권위표) · CODEMAP(탐색 역색인) · explorations
```

`@/` 별칭은 `src/`를 가리킨다.

---

## 개발

### 사전 준비

- Node.js, Expo Dev Client 빌드 환경(Android Studio 등)
- `.env` 및 Secure Store에 STT/AI API 키 설정 (API 키는 Secure Store에 분리 저장 — ADR-015)

### 실행

```bash
npm install

# 네이티브 프로젝트 생성 후 디바이스/에뮬레이터 빌드
npm run prebuild          # build:plugin + expo prebuild
npm run android           # 또는 npm run ios

# Metro 개발 서버
npm start
```

> Expo Dev Client를 사용하므로 Expo Go로는 실행되지 않는다. 초기 네이티브 빌드는 다소 시간이 걸린다(ADR-018).

### 검증

변경 후 반드시 통과시킬 것:

```bash
npm run verify
```

`verify`는 다음을 묶어 실행한다 (CI `verify.yml`과 동일):

- `typecheck` — `tsc --noEmit`
- `check:invariants` — [`INVARIANTS.md`](./INVARIANTS.md)의 기계가독 불변식 강제 (`scripts/check-invariants.sh`)
- `check:migrations` — 마이그레이션 append-only 해시 락 (`scripts/check-migrations.mjs`)

---

## 코딩 컨벤션

- `async/await` 사용 (`Promise.then` 금지)
- 함수형 repo (클래스/DI 금지)
- 명시적 타입 (`any` 금지, `unknown`은 허용)
- 한 파일 200줄 이내 권장, 한 번에 한 파일씩
- import는 `@/...` 우선
- 색·간격·라운드·그림자·폰트는 `@/theme` 토큰 사용 — 매직넘버·`#RRGGBB` 하드코딩 금지
- `src/theme/tokens.ts`의 `palette` 직접 import 금지 (semantic 토큰 경유)
- DB 컬럼 매핑 외에는 snake_case 변수명 금지

자세한 규칙과 절대 금지 사항은 [`CLAUDE.md`](./CLAUDE.md)를 따른다.

---

## 문서 안내

작업 전 [`docs/INDEX.md`](./docs/INDEX.md)의 **권위 등급(authority map)** 을 먼저 읽어 어떤 문서가 "따라야 할 규칙"인지 식별한다. 문서 스냅샷과 실제 코드가 다르면 **코드가 이긴다.**

| 문서 | 역할 |
|------|------|
| `CLAUDE.md` | 최상위 진실원 — 기술 스택·코딩 스타일·절대 금지·하네스 |
| `SnackShot-ADR.md` / `-Phase0.md` | 핵심 아키텍처 결정 기록 (근거 서사) |
| `SnackShot-DesignSystem.md` | UI/UX 디자인 시스템 |
| `INVARIANTS.md` | 강제 가능한 불변식 (QA 검사와 1:1) |
| `docs/CODEMAP.md` | 탐색 역색인 (엔티티/화면 역참조) |

---

## 라이선스

[LICENSE](./LICENSE) 참조.
