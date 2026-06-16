/**
 * DB row(snake_case) → 도메인 객체(camelCase) 매핑 빌더 (P2-1).
 *
 * 목적: 컬럼 추가 시 수작업 동기화 지점을 줄인다. 각 엔티티는 "도메인 필드 → [컬럼, 종류]"
 * 카탈로그 하나만 선언하고, 매핑 함수는 여기서 파생한다.
 *
 * 안전장치: 카탈로그 타입은 `{ [K in keyof T]-?: ColSpec }`라서 **도메인 타입의 모든 필드를
 * 반드시 포함**해야 한다 — 필드를 빠뜨리면 컴파일 에러(누락 매핑 버그를 작성 시점에 차단).
 *
 * 종류(ColKind):
 * - 'req'  : 필수 값 그대로 (string/number)
 * - 'opt'  : nullable. DB NULL → undefined (도메인 `T | undefined` 컨벤션, ADR 본문)
 * - 'bool' : 0/1 정수 → boolean
 *
 * 비고: 반환 객체는 카탈로그로 좁힌 값을 도메인 타입 `T`로 단언한다. DB CHECK 제약이
 * 리터럴 유니온(mode/status 등)을 보장하므로 안전하다(INVARIANTS.md "CHECK 보장 단언").
 */

export type ColKind = 'req' | 'opt' | 'bool';
export type ColSpec = readonly [column: string, kind: ColKind];

export function makeRowMapper<T>(catalog: {
  readonly [K in keyof T]-?: ColSpec;
}): (row: Record<string, unknown>) => T {
  const specs = Object.entries(catalog) as [keyof T, ColSpec][];
  return (row: Record<string, unknown>): T => {
    const out: Record<string, unknown> = {};
    for (const [key, [col, kind]] of specs) {
      const v = row[col];
      out[key as string] =
        kind === 'bool' ? v === 1 : kind === 'opt' ? (v ?? undefined) : v;
    }
    return out as T;
  };
}
