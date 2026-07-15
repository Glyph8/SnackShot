import type { SQLiteDatabase } from 'expo-sqlite';

import { getLatestPortfolioSnapshot, updateSnapshotPrincipleCheck } from '@/db';
import { nowMs } from '@/lib/time';
import { getLabelService } from '@/services/label';
import type { PrincipleConflict } from '@/services/label/types';
import { readUserProfile } from '@/services/obsidian';
import type { TradeDetails } from '@/services/trade/schema';

// I3(b): 매매 원칙(Profile.md) × 현재 포트폴리오 상시 대조.
// 원칙은 자유 텍스트라 코드 검산 불가 → Gemini 1회 호출 + 스냅샷 행에 캐시(H0: 표시만, 차단 없음).
//   진입 시 lazy 실행: 최신 스냅샷 → 원칙 읽기 → 원칙 해시(djb2, E1 선례)를 스냅샷 캐시와 비교
//   → 같으면 캐시 재사용, 다르거나 새 스냅샷(캐시 NULL)이면 checkPrinciples 1회 후 저장.
// 실패·키 없음·vault 미연동·프로필 없음 → null(섹션 숨김 — 조용, 표시 기능이므로).

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return String(h >>> 0);
}

interface CachedCheck {
  checkedAt: number;
  principlesHash: string;
  conflicts: PrincipleConflict[];
}

export interface PrincipleWatchResult {
  conflicts: PrincipleConflict[];
  checkedAt: number;
}

function parseCache(json: string | undefined): CachedCheck | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      parsed && typeof parsed === 'object'
      && typeof (parsed as CachedCheck).principlesHash === 'string'
      && Array.isArray((parsed as CachedCheck).conflicts)
    ) {
      return parsed as CachedCheck;
    }
  } catch { /* 손상된 캐시 → 재계산 */ }
  return null;
}

// H2 checkPrinciples는 단일 매매 대조용(tradeDetails 필수)이라, 포트폴리오 전반 점검에는
// 자리표시 tradeDetails를 넘기고 실제 컨텍스트는 portfolio로 전달한다(코드 우선 — 완료 보고 기록).
const PORTFOLIO_PLACEHOLDER: TradeDetails = {
  kind: 'trade',
  name: '(현재 포트폴리오 점검)',
  side: 'hold',
};

export async function runPrincipleWatch(db: SQLiteDatabase): Promise<PrincipleWatchResult | null> {
  const snapshot = await getLatestPortfolioSnapshot(db);
  if (!snapshot) return null;
  const principles = await readUserProfile(db);
  if (!principles) return null;

  const hash = djb2(principles);
  const cache = parseCache(snapshot.principleCheckJson);
  if (cache && cache.principlesHash === hash) {
    console.log('[principleWatch] cache hit');
    return { conflicts: cache.conflicts, checkedAt: cache.checkedAt };
  }

  try {
    const conflicts = await getLabelService().checkPrinciples({
      summary: '보유 종목 전반이 매매 원칙에 맞는지 점검',
      tradeDetails: PORTFOLIO_PLACEHOLDER,
      principles,
      portfolio: snapshot,
    });
    const checkedAt = nowMs();
    const payload: CachedCheck = { checkedAt, principlesHash: hash, conflicts };
    await updateSnapshotPrincipleCheck(db, snapshot.id, JSON.stringify(payload));
    console.log(`[principleWatch] gemini checked, conflicts=${conflicts.length}`);
    return { conflicts, checkedAt };
  } catch (e) {
    console.warn('[principleWatch] check failed (silent)', e);
    return null;
  }
}
