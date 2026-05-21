/**
 * ULID 기반 ID 생성/검증 (ADR-009).
 * - 26자 Crockford base32
 * - 시간 정렬 가능 (앞 10자 = 타임스탬프)
 */

import { ulid } from 'ulid';

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function newId(): string {
  return ulid();
}

export function isValidId(id: string): boolean {
  return ULID_REGEX.test(id);
}
