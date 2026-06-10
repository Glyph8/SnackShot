/**
 * ULID 기반 ID 생성/검증 (ADR-009).
 * - 26자 Crockford base32, 시간 정렬 가능
 *
 * ulid 라이브러리의 detectPRNG()는 window/global 순으로 crypto를 탐색하는데
 * React Native Hermes 환경에서는 globalThis.crypto만 존재해 탐색에 실패한다.
 * monotonicFactory()에 PRNG를 명시적으로 주입해 우회.
 */

import { monotonicFactory } from 'ulid';

function makePrng(): () => number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint8Array(1);
    return () => {
      c.getRandomValues(buf);
      return buf[0] / 256;
    };
  }
  // ADR-009: 시간 정렬 가능 ID가 목적이며 암호학적 보안성 불요 → Math.random 허용
  return () => Math.random();
}

const _ulid = monotonicFactory(makePrng());

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function newId(): string {
  return _ulid();
}

export function isValidId(id: string): boolean {
  return ULID_REGEX.test(id);
}
