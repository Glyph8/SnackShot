import { format } from 'date-fns';
import { Directory } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getDecisionsByEntry, getEntriesByDay, getEntry, getLatestTranscript,
  getOutcomeByDecision, getSettings, updateExportedAt,
} from '@/db';
import { getDayBoundary } from '@/lib/time';
import { obsidianExportService } from '@/services/obsidian';
import type { AiJob } from '@/types/domain';

import { CancelJobError, RescheduleError } from './signals';

/**
 * 옵시디언 export 핸들러 (ADR-026 2단계).
 *
 * 전제 조건:
 *  - 압축 완료 (skipped 포함) — 미완료 시 RescheduleError
 *  - vault 연결됨 — 미연결 시 CancelJobError
 *  - vault 권한 유효 — 만료 시 일반 에러(재시도)
 */
export async function handleObsidianExport(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const entry = await getEntry(db, job.targetId);
  if (!entry) throw new Error(`entry not found: ${job.targetId}`);

  // 압축 대기 중 → 재예약 (실패 카운트 소모 없음)
  if (
    entry.compressionStatus === 'pending' ||
    entry.compressionStatus === 'processing'
  ) {
    throw new RescheduleError(2 * 60_000, '압축 대기 중 — 2분 후 재시도');
  }

  const settings = await getSettings(db);

  // vault 미연결 → cancelled (재시도 무의미)
  if (!settings.obsidianVaultUri) {
    throw new CancelJobError('옵시디언 vault 미연결 — 설정에서 폴더를 연결하세요');
  }

  // vault 권한 확인 (만료 시 에러로 재시도)
  const vaultDir = new Directory(settings.obsidianVaultUri);
  if (!vaultDir.exists) {
    throw new Error('vault 접근 권한 만료 — 설정에서 다시 연결 필요');
  }

  // 논리적 하루 전체를 수집해 데일리 노트를 재생성 (하루 1 md, 시간순 — ADR-026)
  const { start, end } = getDayBoundary(entry.recordedAt, settings.dayBoundaryHour);
  const dayEntries = await getEntriesByDay(db, start, end);
  const items = await Promise.all(
    dayEntries.map(async (e) => {
      const [transcript, allDecisions] = await Promise.all([
        getLatestTranscript(db, e.id),
        getDecisionsByEntry(db, e.id),
      ]);
      // confirmed/edited만 포함 — rejected/extracted 절대 포함 금지 (ADR-006/014)
      const confirmedDecisions = allDecisions.filter(
        (d) => d.status === 'confirmed' || d.status === 'edited',
      );
      const decisions = await Promise.all(
        confirmedDecisions.map(async (d) => ({
          decision: d,
          outcome: await getOutcomeByDecision(db, d.id),
        })),
      );
      return { entry: e, transcript, decisions };
    }),
  );
  items.sort((a, b) => a.entry.recordedAt - b.entry.recordedAt);

  // start는 논리적 하루의 경계 시각이므로 로컬 날짜가 곧 논리적 날짜
  const logicalDate = format(new Date(start), 'yyyy-MM-dd');

  console.log(`[obsidian] export start day=${logicalDate} entries=${items.length} (trigger=${entry.id})`);
  obsidianExportService.exportDay(vaultDir, logicalDate, items);

  const now = Date.now();
  for (const item of items) {
    await updateExportedAt(db, item.entry.id, now);
  }
  console.log(`[obsidian] export done day=${logicalDate}`);
}
