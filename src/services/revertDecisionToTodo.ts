/**
 * 결정을 다시 "진행 중" todo로 되돌린다 (v8 Phase 4.1).
 *
 * 의사결정 모아보기 화면에서 호출. 완료(수행/결과) 또는 반려된 결정을 활성 상태로 복원한다:
 *   - 결과(outcome)가 있으면 soft delete
 *   - executed_at 해제 → 보드 "진행 중"으로 복귀
 *   - 반려(rejected) 상태면 confirmed로 복원
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getDecision, getOutcomeByDecision, softDeleteOutcome,
  unmarkDecisionExecuted, updateDecisionStatus,
} from '@/db';

export async function revertDecisionToTodo(db: SQLiteDatabase, id: string): Promise<void> {
  const outcome = await getOutcomeByDecision(db, id);
  if (outcome) await softDeleteOutcome(db, outcome.id);

  await unmarkDecisionExecuted(db, id);

  const decision = await getDecision(db, id);
  if (decision?.status === 'rejected') {
    await updateDecisionStatus(db, id, 'confirmed');
  }
}
