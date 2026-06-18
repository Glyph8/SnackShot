/**
 * 홈 화면 위젯 ↔ 앱 데이터 브리지 (v8 위젯).
 *
 * 위젯(네이티브)은 SQLite를 직접 못 읽으므로, 앱이 결정 목록을 JSON 파일로
 * 문서 디렉토리(= Android context.filesDir)에 내보낸다. 위젯의 RemoteViewsFactory가
 * 이 파일을 읽어 목록을 그린다.
 *
 * 표시 범위: 진행 중(done=false) + 수행 완료했지만 회고 미작성(done=true, 7일 윈도우).
 *   → 체크해도 위젯에서 바로 사라지지 않고 '완료' 상태로 보인다.
 *
 * 위젯에서 행을 탭하면 done이 토글되고 pending 파일에 {id, action}이 적재된다 →
 * 앱이 포그라운드로 올 때 reconcile로 SQLite에 반영(check=수행완료, uncheck=체크취소).
 *
 * 파일명은 네이티브(DecisionsWidgetProvider.DATA_FILE/PENDING_FILE)와 1:1로 일치해야 한다.
 */
import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getActiveUpcomingDecisions, getDecisionsDueForFollowUp,
  getPendingReflectionDecisions, markDecisionExecuted, unmarkDecisionExecuted,
} from '@/db';
import { nowMs } from '@/lib/time';
import type { Decision, DecisionCategory } from '@/types/domain';

const DATA_FILE = 'snackshot_widget.json';
const PENDING_FILE = 'snackshot_widget_pending.json';
const MAX_ITEMS = 30;
const REFLECTION_WINDOW_MS = 7 * 86_400_000; // 완료(회고 대기) 노출 기간 — 보드와 동일

const CATEGORY_LABEL: Record<DecisionCategory, string> = {
  investment: '투자', relationship: '관계', career: '커리어', daily: '일상', other: '기타',
};

function toItem(d: Decision, done: boolean) {
  return {
    id: d.id,
    title: (d.userSummary ?? d.summary).slice(0, 80),
    category: CATEGORY_LABEL[d.userCategory ?? d.category] ?? '',
    done,
  };
}

function writeDocFile(name: string, content: string): void {
  const f = new File(Paths.document, name);
  f.create({ overwrite: true });
  f.write(content);
}

/** 진행 중 + 완료(회고 대기) 결정을 위젯용 JSON으로 내보낸다. */
export async function exportWidgetDecisions(db: SQLiteDatabase): Promise<void> {
  try {
    const now = nowMs();
    const [due, upcoming, reflection] = await Promise.all([
      getDecisionsDueForFollowUp(db, now),
      getActiveUpcomingDecisions(db, now),
      getPendingReflectionDecisions(db, now, REFLECTION_WINDOW_MS),
    ]);
    const active = [...due, ...upcoming].map((d) => toItem(d, false));
    const done = reflection.map((d) => toItem(d, true));
    const decisions = [...active, ...done].slice(0, MAX_ITEMS);
    writeDocFile(DATA_FILE, JSON.stringify({ updatedAt: now, count: active.length, decisions }));
  } catch (e) {
    console.warn('[widget] export failed', e);
  }
}

/**
 * 위젯에서 토글한 항목(pending)을 SQLite에 반영한다.
 * pending: Array<{ id: string; action: 'check' | 'uncheck' }> (구버전 string[]도 check로 처리)
 */
export async function reconcileWidgetActions(db: SQLiteDatabase): Promise<boolean> {
  try {
    const f = new File(Paths.document, PENDING_FILE);
    if (!f.exists) return false;
    const raw = f.textSync();
    f.delete();
    const items: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(items) || items.length === 0) return false;
    for (const it of items) {
      if (typeof it === 'string') {
        await markDecisionExecuted(db, it);
        continue;
      }
      if (it && typeof it === 'object') {
        const rec = it as Record<string, unknown>;
        const id = rec.id;
        if (typeof id !== 'string') continue;
        if (rec.action === 'uncheck') await unmarkDecisionExecuted(db, id);
        else await markDecisionExecuted(db, id);
      }
    }
    return true;
  } catch (e) {
    console.warn('[widget] reconcile failed', e);
    return false;
  }
}

/** 포그라운드 진입·앱 시작 시: pending 반영 후 최신 데이터 export. */
export async function syncWidget(db: SQLiteDatabase): Promise<void> {
  await reconcileWidgetActions(db);
  await exportWidgetDecisions(db);
}
