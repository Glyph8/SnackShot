/**
 * 일괄 obsidian export 큐잉 (ADR-026 3단계).
 *
 * 사용처:
 * - 첫 vault 연결 직후 "기존 일기 N개 내보내기" 확인 시 (settings 화면)
 * - "전체 다시 내보내기" 버튼
 *
 * 핵심 동작:
 *   1. entryIds 집합에서 각 entry의 recordedAt을 단일 SELECT(getAllEntryBasics)로 조회.
 *   2. 논리적 날짜(dayBoundaryHour 적용, 'yyyy-MM-dd')로 그룹화 후 날짜별 첫 entry만
 *      enqueueJob. 워커는 같은 날의 모든 entry를 재집계해 데일리 노트를 통째로
 *      재생성하므로 날짜당 1개 잡이면 충분 (ADR-012의 멱등성 활용).
 *   3. 모든 대상 entry의 exported_at 초기화 — 잡이 성공할 때까지 설정 화면 통계에
 *      "미내보냄"으로 정확히 집계되도록. (성공 시 핸들러가 다시 채운다.)
 *
 * 반환: 실제 큐잉된 잡 개수(= 고유 날짜 수). UI는 이 값을 토스트에 표시.
 */

import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import { clearExportedAt, enqueueJob, getAllEntryBasics, getSettings } from '@/db';

export async function enqueueBulkExport(
  db: SQLiteDatabase,
  entryIds: string[],
): Promise<number> {
  if (entryIds.length === 0) return 0;

  // 1) 단일 SELECT로 모든 entry basics 조회 후 요청 집합으로 필터링.
  //    N개 entry를 개별 getEntry로 조회하면 N왕복 — 일괄 작업에선 부적합.
  const idSet = new Set(entryIds);
  const allBasics = await getAllEntryBasics(db);
  const targets = allBasics.filter((b) => idSet.has(b.id));

  // 2) 논리적 날짜 키로 그룹화 — boundaryHour만큼 뒤로 shift하면 논리적 하루의
  //    자정으로 매핑됨 (export 핸들러·countEntriesByMonth와 동일 규칙).
  //    allBasics는 recorded_at ASC 정렬이므로 Map.set은 첫 entry에서만 기록됨.
  const { dayBoundaryHour } = await getSettings(db);
  const firstByDate = new Map<string, string>();
  for (const { id, recordedAt } of targets) {
    const key = format(
      new Date(recordedAt - dayBoundaryHour * 3_600_000),
      'yyyy-MM-dd',
    );
    if (!firstByDate.has(key)) {
      firstByDate.set(key, id);
    }
  }

  // 3) 날짜별 첫 entry만 enqueueJob. enqueueJob 내부는 INSERT 1건.
  for (const entryId of firstByDate.values()) {
    await enqueueJob(db, 'obsidian_export', entryId, 'entries');
  }

  // 4) 모든 대상 entry의 exported_at 초기화 — 잡 성공 전까지 통계가
  //    "미내보냄"을 정확히 반영하도록. 핸들러가 성공 시 다시 채운다.
  for (const { id } of targets) {
    await clearExportedAt(db, id);
  }

  return firstByDate.size;
}
