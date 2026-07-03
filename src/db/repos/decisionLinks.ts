import type { SQLiteDatabase } from 'expo-sqlite';

import { makeRowMapper } from '@/db/mapping';
import { newId } from '@/lib/id';
import { nowMs } from '@/lib/time';
import type { Decision, DecisionLink } from '@/types/domain';

import { getDecision } from './decisions';

// decision_links (v1부터 존재하던 미사용 테이블) 가동 — D4-b.
// ⚠️ 하드 delete 테이블(deleted_at 없음). soft delete를 추가하지 말 것.

const toDecisionLink = makeRowMapper<DecisionLink>({
  id: ['id', 'req'],
  fromDecisionId: ['from_decision_id', 'req'],
  toDecisionId: ['to_decision_id', 'req'],
  linkType: ['link_type', 'req'],
  note: ['note', 'opt'],
  createdAt: ['created_at', 'req'],
});

export async function insertDecisionLink(
  db: SQLiteDatabase,
  params: { fromDecisionId: string; toDecisionId: string; linkType: string; note?: string },
): Promise<DecisionLink> {
  const id = newId();
  const createdAt = nowMs();
  await db.runAsync(
    `INSERT INTO decision_links (id, from_decision_id, to_decision_id, link_type, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.fromDecisionId, params.toDecisionId, params.linkType, params.note ?? null, createdAt],
  );
  return { id, ...params, createdAt };
}

// 양방향 조회 — decisionId가 from이든 to든 모두 반환.
export async function getLinksForDecision(
  db: SQLiteDatabase,
  decisionId: string,
): Promise<DecisionLink[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM decision_links
     WHERE from_decision_id = ? OR to_decision_id = ?
     ORDER BY created_at DESC`,
    [decisionId, decisionId],
  );
  return rows.map(toDecisionLink);
}

// 하드 delete (테이블에 deleted_at 없음 — 설계상 물리 삭제가 맞다).
export async function deleteDecisionLink(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM decision_links WHERE id = ?', [id]);
}

// 표시용 — 연관된 상대 결정(soft-deleted 제외)과 링크를 함께 반환.
export interface RelatedDecision {
  link: DecisionLink;
  decision: Decision;
}

export async function getRelatedDecisions(
  db: SQLiteDatabase,
  decisionId: string,
): Promise<RelatedDecision[]> {
  const links = await getLinksForDecision(db, decisionId);
  const out: RelatedDecision[] = [];
  for (const link of links) {
    const otherId = link.fromDecisionId === decisionId ? link.toDecisionId : link.fromDecisionId;
    const decision = await getDecision(db, otherId);
    if (decision) out.push({ link, decision });
  }
  return out;
}
