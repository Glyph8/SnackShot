import type { SQLiteDatabase } from 'expo-sqlite';

import { getRecentDecisionDigest, getSettings } from '@/db';
import { readUserProfile } from '@/services/obsidian/profile';

import type { AiContext } from './types';

// E3: 개인화 맥락 조립.
//   - 프로필: 전역 토글(profileAiEnabled, v19) + 호출별 includeProfile이 모두 참일 때만 주입.
//   - 최근 결정 다이제스트: withDigest 옵션.
//   - 추출: 프로필만(다이제스트 X — E2 반려 예시와 이중 주입 금지). compose/rewrite: 프로필 + 다이제스트.
export async function getAiContext(
  db: SQLiteDatabase,
  opts: { withDigest: boolean; includeProfile?: boolean },
): Promise<AiContext> {
  const settings = await getSettings(db);
  const useProfile = (opts.includeProfile ?? true) && settings.profileAiEnabled;
  const profile = useProfile ? await readUserProfile(db) : null;
  const recentDigest = opts.withDigest ? await getRecentDecisionDigest(db) : undefined;
  return { profile: profile ?? undefined, recentDigest };
}
