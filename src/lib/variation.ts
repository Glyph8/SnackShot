// 손글씨/장식 변주 유틸 — "고정하지 않되 렌더 중엔 안 흔들리는" 결정적 의사난수.
//
// 시드 = key 해시 ⊕ 로컬 날짜(일 단위) ⊕ 앱 실행 솔트.
//  · 같은 날·같은 실행·같은 key → 항상 같은 값(리렌더/탭이동에도 안 바뀜 → 깜빡임 없음).
//  · 날이 바뀌거나(자정) 앱을 새로 켜면 → 값이 바뀐다(= 날마다 + 실행마다 변주).
//
// 카덴스 조정: 날마다만 원하면 LAUNCH_SALT를 0으로, 실행마다만 원하면 dayOrdinal을 0으로 두면 된다.

/** 앱 실행마다 한 번 정해지는 솔트(프로세스 수명 동안 고정) */
const LAUNCH_SALT = Math.floor(Math.random() * 0xffffffff) >>> 0;

/** 결정적 [0,1) 의사난수 (mulberry32) */
function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 문자열 해시(djb2) */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** 로컬 타임존 기준 '며칠째'(일 단위 정수) — 자정에 1 증가 */
function localDayOrdinal(): number {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

/** key로부터 그날·그 실행에 고정되는 [0,1) 값 */
export function variationValue(key: string): number {
  const seed = (hashString(key) ^ Math.imul(localDayOrdinal(), 0x9e3779b1) ^ LAUNCH_SALT) >>> 0;
  return mulberry32(seed);
}

/** 배열에서 key 기반으로 하나 선택(날마다/실행마다 변주, 렌더 중엔 고정) */
export function pickVaried<T>(arr: readonly T[], key: string): T {
  return arr[Math.floor(variationValue(key) * arr.length)] as T;
}
