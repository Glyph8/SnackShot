import type { SQLiteDatabase } from 'expo-sqlite';

import { getEntry, getLatestTranscript, insertDecision, updateAiLabelStatus } from '@/db';
import { nowMs } from '@/lib/time';
import { getLabelService } from '@/services/label';
import type { AiJob } from '@/types/domain';

import { RescheduleError } from './signals';

/**
 * 라벨 추출 핸들러 (ADR-006/007/008/016/017/027).
 *
 * voice/audio: getLatestTranscript → editedText ?? rawText.
 *   transcript 없으면 STT 대기 중 → RescheduleError(5분).
 * silent/text: manualNote 있으면 사용, 없으면 'skipped' 후 종료.
 *   text 모드는 사용자가 직접 입력한 본문이 manualNote에 들어있다(insertTextEntry).
 *
 * 결정 status는 항상 'extracted' — 자동 컨펌 금지 (ADR-006).
 * followUpSetBy='ai' (ADR-017). AI 원본 컬럼만 채움 (ADR-016).
 */
export async function handleLabelExtraction(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const entry = await getEntry(db, job.targetId);
  if (!entry) throw new Error(`entry not found: ${job.targetId}`);

  let text: string;

  if (entry.mode === 'silent' || entry.mode === 'text') {
    if (!entry.manualNote) {
      await updateAiLabelStatus(db, entry.id, 'skipped');
      console.log(`[label] skip — ${entry.mode}, no note id=${entry.id}`);
      return;
    }
    text = entry.manualNote;
  } else {
    // voice / audio — transcript 완료 대기
    const transcript = await getLatestTranscript(db, entry.id);
    if (!transcript) {
      // 무음(skipped)·실패는 영원히 기다릴 수 없음 → 라벨도 skip (무한 재예약 방지)
      if (entry.sttStatus === 'skipped' || entry.sttStatus === 'failed') {
        await updateAiLabelStatus(db, entry.id, 'skipped');
        console.log(`[label] skip — STT ${entry.sttStatus}, no transcript id=${entry.id}`);
        return;
      }
      throw new RescheduleError(5 * 60_000, 'STT 대기 중');
    }
    text = transcript.editedText ?? transcript.rawText;
  }

  await updateAiLabelStatus(db, entry.id, 'processing');

  const labelService = getLabelService();
  const result = await labelService.extractDecisions(text, {
    userDecisionHint: entry.userDecisionHint,
    recordedAtIso: new Date(entry.recordedAt).toISOString(),
    durationSec: entry.durationMs / 1000,
  });

  const { name: aiEngine } = labelService.getEngineInfo();
  const extractedAt = nowMs();

  for (const candidate of result.candidates) {
    await insertDecision(db, {
      entryId: entry.id,
      summary: candidate.summary,
      category: candidate.category,
      situation: candidate.situation,
      reasoning: candidate.reasoning,
      alternatives: candidate.alternatives,
      expectedOutcome: candidate.expectedOutcome,
      evidenceQuote: candidate.evidence,
      confidence: candidate.confidence,
      userSummary: undefined,
      userCategory: undefined,
      userSituation: undefined,
      userReasoning: undefined,
      status: 'extracted',
      origin: 'ai_extracted',
      followUpAt: candidate.followUpAfterDays != null
        ? entry.recordedAt + candidate.followUpAfterDays * 86_400_000
        : undefined,
      followUpSetBy: 'ai',
      extractedAt,
      confirmedAt: undefined,
      executedAt: undefined,
      aiEngine,
      tagsJson: undefined,
    });
  }

  await updateAiLabelStatus(db, entry.id, 'done');
  console.log(
    `[label] done id=${entry.id} mode=${entry.mode} decisions=${result.candidates.length}`,
  );
}
