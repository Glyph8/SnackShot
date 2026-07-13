/**
 * 의도적 작성 결정 저장 단일 경로 (v8 Phase 3).
 *
 * compose-decision.tsx가 사용한다. 화면은 입력 수집·검토만 담당하고,
 * 엔트리 생성·결정 insert·옵시디언 큐잉은 여기서 처리한다(다단계 워크플로는 service).
 *
 * ADR-003 유지: 결정은 항상 Entry에 매단다 → text 모드 Entry를 호스트로 생성한다.
 * 자동 발굴과 달리 추출 잡(label_extraction)은 큐잉하지 않는다 — 사용자가 직접 작성했으므로
 * ai_label_status를 즉시 'done'으로 마감한다.
 * 결과 status='confirmed', origin='authored' → 추가되는 즉시 결정 보드의 "진행 중"에 노출된다.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  enqueueJob, getSettings, insertDecision, insertTextEntry, updateAiLabelStatus,
} from '@/db';
import { nowMs } from '@/lib/time';
import { parseTradeDetails } from '@/services/trade/schema';
import { kickWorker } from '@/services/jobs/queue';
import { syncFollowUpForDecision } from '@/services/followUpNotifications';
import type { Decision, DecisionCategory } from '@/types/domain';

const DAY_MS = 86_400_000;

export interface AuthoredDecisionInput {
  summary: string;
  category: DecisionCategory;
  /** 사용자 커스텀 카테고리 라벨 (있으면 category는 'other'로 저장) */
  customCategory?: string;
  situation: string;
  alternatives: string;
  reasoning: string;
  expectedOutcome: string;
  /** 후속 확인까지 일수 (없으면 follow_up 미설정) */
  followUpAfterDays?: number | null;
  /** 본인 입력 확신도(0~1) — 미선택이면 undefined (F3) */
  userConfidence?: number;
  /** 기록 시각 (기본 now) */
  recordedAt?: number;
  /** F5/ADR-028: 미결(deliberating)로 저장 — summary만 필수, 확정 전 단계 */
  deliberating?: boolean;
  /** 미결 결정 마감 시각(UTC ms) — deliberating일 때만 의미 */
  decideBy?: number;
  /** 매매 정량 필드 JSON(TradeDetails) — investment 매매 결정에서만 (H1) */
  structuredJson?: string;
}

export async function saveAuthoredDecision(
  db: SQLiteDatabase,
  input: AuthoredDecisionInput,
): Promise<Decision> {
  const recordedAt = input.recordedAt ?? nowMs();

  // 호스트 text 엔트리 생성 후 추출 잡 없이 라벨 단계 마감
  const entry = await insertTextEntry(db, { recordedAt, body: input.summary });
  await updateAiLabelStatus(db, entry.id, 'done');

  const now = nowMs();
  const isDeliberating = input.deliberating === true;
  const hasFollowUp = !isDeliberating && input.followUpAfterDays != null && input.followUpAfterDays > 0;

  const decision = await insertDecision(db, {
    entryId: entry.id,
    summary: input.summary,
    category: input.category,
    customCategory: input.customCategory,
    situation: input.situation,
    reasoning: input.reasoning,
    alternatives: input.alternatives,
    expectedOutcome: input.expectedOutcome,
    evidenceQuote: undefined,
    confidence: 1, // 사용자가 직접 작성 → 최대 신뢰
    userSummary: undefined,
    userCategory: undefined,
    userSituation: undefined,
    userReasoning: undefined,
    userConfidence: input.userConfidence,
    status: isDeliberating ? 'deliberating' : 'confirmed',
    origin: 'authored',
    followUpAt: hasFollowUp ? recordedAt + (input.followUpAfterDays as number) * DAY_MS : undefined,
    followUpSetBy: hasFollowUp ? 'user' : undefined,
    extractedAt: now,
    confirmedAt: isDeliberating ? undefined : now,
    executedAt: undefined,
    decideBy: isDeliberating ? input.decideBy : undefined,
    structuredJson: input.structuredJson,
    aiEngine: 'authored',
    tagsJson: undefined,
  });

  // 미결은 마감(decide_by) 알림을 예약(shouldSchedule 미결 분기). 확정 결정의 후속 알림은 부트 resync가 담당.
  if (isDeliberating) await syncFollowUpForDecision(db, decision.id);

  // H4: 매매 결정(ticker 있음)이면 결정 시점 종가 스냅샷을 백그라운드로 조회·기입.
  const td = parseTradeDetails(input.structuredJson);
  if (td?.ticker) {
    await enqueueJob(db, 'quote_fetch', decision.id, 'decisions', JSON.stringify({ ticker: td.ticker, date: recordedAt }));
    kickWorker();
  }

  // 옵시디언 자동 export (vault 연결 + autoExport 시). 미결은 확정 전이라 export 대상 아님.
  const settings = await getSettings(db);
  if (!isDeliberating && settings.obsidianVaultUri && settings.obsidianAutoExport) {
    await enqueueJob(db, 'obsidian_export', entry.id, 'entries');
    kickWorker();
  }

  return decision;
}
