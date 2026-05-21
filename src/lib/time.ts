/**
 * 시간 유틸 (ADR-013).
 * - 저장/계산은 UTC Unix ms
 * - 표시(format)나 "하루" 경계 계산은 로컬 타임존 기준
 */

import {
  addDays,
  addHours,
  format,
  isToday,
  isYesterday,
  startOfDay,
  subDays,
} from 'date-fns';

export function nowMs(): number {
  return Date.now();
}

export function dateToMs(date: Date): number {
  return date.getTime();
}

export function msToDate(ms: number): Date {
  return new Date(ms);
}

/**
 * 로컬 타임존 기준 "논리적 하루"의 시작/끝 ms.
 * boundaryHour=4면 새벽 4시가 하루의 경계.
 * - 입력 ms가 boundaryHour 이전이면 전날 boundaryHour부터 시작.
 * - end는 다음날 boundaryHour (exclusive).
 */
export function getDayBoundary(
  ms: number,
  boundaryHour: number,
): { start: number; end: number } {
  const date = new Date(ms);
  const todayBoundary = addHours(startOfDay(date), boundaryHour);
  const start =
    date.getTime() < todayBoundary.getTime()
      ? addHours(startOfDay(subDays(date, 1)), boundaryHour)
      : todayBoundary;
  const end = addDays(start, 1);
  return { start: start.getTime(), end: end.getTime() };
}

/**
 * 한국어 상대 시간 표시.
 * "방금 전" / "10분 전" / "3시간 전" / "어제 14:30" / "5월 19일 14:30"
 */
export function formatRelative(ms: number): string {
  const now = Date.now();
  const diffMs = now - ms;
  const date = new Date(ms);

  if (diffMs < 60_000) return '방금 전';

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;

  if (isToday(date)) {
    const diffHour = Math.floor(diffMs / (60 * 60_000));
    return `${diffHour}시간 전`;
  }

  if (isYesterday(date)) return `어제 ${format(date, 'HH:mm')}`;

  return format(date, 'M월 d일 HH:mm');
}
