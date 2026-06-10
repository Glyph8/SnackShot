# SnackShot — 동영상 다이어리

본인 사용 도구. AI 어시스턴트와의 페어 코딩으로 개발 중.
모든 의사결정은 `SnackShot-ADR.md`와 `SnackShot-ADR-Phase0.md`에 기록되어 있다.

## 기술 스택
- React Native 0.83 + Expo SDK 55 (Dev Client, New Architecture)
- TypeScript strict mode
- expo-router (file-based routing, Next.js app router 유사)
- Zustand (상태관리)
- expo-sqlite (openDatabaseAsync API만 사용, legacy API 금지)
- ULID (ID 생성)
- Zod (스키마 검증)
- date-fns (시간)

## 설계 원칙 (ADR 요약)
1. **클립이 1급 객체** (ADR-003). Day는 시간순 그룹화 뷰.
2. **시각은 UTC Unix ms (INTEGER)** (ADR-013). UI 표시 시에만 로컬 변환.
3. **Soft delete** (ADR-014). 모든 쿼리에 `WHERE deleted_at IS NULL`.
4. **ID는 ULID** (ADR-009). `@/lib/id.ts`의 `newId()` 사용.
5. **DB 컬럼 snake_case ↔ TS 객체 camelCase**. 변환은 repo 안에서 (ADR 본문).
6. **AI 원본 보존** (ADR-016). 사용자 편집본은 별도 컬럼.
7. **Transcript는 별도 테이블** (ADR-010). 1:N.
8. **백그라운드 큐는 DB 기반** (ADR-012). ai_jobs 테이블.
9. **STT/AI 라벨링은 인터페이스로 추상화** (ADR-002, ADR-008). 구현체 교체 자유.

## 폴더 컨벤션
- `app/` — expo-router 화면 (직접 수정)
- `src/db/` — schema, migrations, repos (snake_case SQL은 여기만)
- `src/services/` — STT, label, video, jobs (인터페이스 + 구현체 분리)
- `src/stores/` — zustand stores
- `src/components/` — 재사용 UI
- `src/lib/` — id, time 등 유틸
- `src/types/` — 도메인 타입 (camelCase)
- `@/` alias → `src/`

## 코딩 스타일
- async/await (Promise.then 금지)
- 함수형 repo (클래스/DI 금지)
- 명시적 타입 (`any` 금지, `unknown`은 OK)
- 한 파일 200줄 이내 권장
- import는 `@/...` 우선
- 한 번에 한 파일씩 단순하게

## 작업 흐름
1. 변경 후 `npx tsc --noEmit`로 타입 통과 확인
2. DB 관련 변경은 콘솔 로그로 동작 확인
3. UI 변경은 에뮬레이터 시각 확인 (Metro reload)
4. ADR 위반 시 즉시 지적

## 절대 금지
- ADR 결정 임의 변경 (질문 후 ADR 갱신)
- `expo-sqlite` legacy callback API 사용
- `any` 타입
- snake_case 변수명 (DB row 매핑 외)
- expo-av 사용 (deprecated, expo-video/expo-audio 사용)

## 하네스: SnackShot 개발

**목표:** DB/Service/UI 레이어별 전문 에이전트가 협력하여 ADR 원칙을 준수한 기능을 구현한다.

**트리거:** 코드를 직접 변경하는 개발 요청 시 `feature-dev` 스킬을 사용하라. 단순 질문·설명·ADR 검토는 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-10 | 초기 구성 | 전체 | - |
