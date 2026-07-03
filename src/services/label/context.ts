import type { SQLiteDatabase } from 'expo-sqlite';

import { getRecentDecisionDigest } from '@/db';
import { readUserProfile } from '@/services/obsidian/profile';

import type { AiContext } from './types';

// E3: 개인화 맥락 조립. 프로필은 항상, 최근 결정 다이제스트는 옵션.
//   - 추출: 프로필만(다이제스트 X — E2 반려 예시와 이중 주입 금지).
//   - compose/rewrite: 프로필 + 다이제스트.
export async function getAiContext(
  db: SQLiteDatabase,
  opts: { withDigest: boolean },
): Promise<AiContext> {
  const profile = await readUserProfile(db);
  const recentDigest = opts.withDigest ? await getRecentDecisionDigest(db) : undefined;
  return { profile: profile ?? undefined, recentDigest };
}
