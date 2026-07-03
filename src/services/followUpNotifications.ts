/**
 * 후속 확인 로컬 알림 (D3-b, ADR-017).
 *
 * 결정(confirmed/edited)에 follow_up_at이 있으면 그 시각에 로컬 알림을 예약한다.
 * identifier = decision.id 로 결정당 정확히 1개 — 재스케줄 시 자동 대체(중복 방지).
 *
 * ⚠️ Expo SDK 55 API 기준(설치된 expo-notifications@55.0.23의 타입으로 확인):
 *   - DATE 트리거는 { type: SchedulableTriggerInputTypes.DATE, date } 형태(구 API와 다름).
 *   - 포그라운드 표시는 NotificationBehavior의 shouldShowBanner/shouldShowList 필수.
 *   - 권한은 get/requestPermissionsAsync().granted.
 *
 * 설정(settings.notificationsEnabled)이 꺼져 있거나 권한이 없으면 조용히 no-op한다
 * (개인 도구 — 재촉 UI 없음).
 */
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getActiveUpcomingDecisions, getDecision, getSettings } from '@/db';
import { nowMs } from '@/lib/time';
import type { Decision } from '@/types/domain';

const CHANNEL_ID = 'follow-ups';

// 포그라운드에서도 배너/목록에 표시(SDK 55: 4개 필드 필수). 소리·배지는 끔.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '후속 확인',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// 최초 활성화 시 권한 요청. 반환: 허용 여부.
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// 미래 시각의 확정/수정 결정만 예약 대상. 지난 시각은 인앱 배지에 맡긴다.
function shouldSchedule(d: Decision, now: number): boolean {
  return (
    (d.status === 'confirmed' || d.status === 'edited') &&
    d.followUpAt != null &&
    d.followUpAt > now &&
    d.executedAt == null
  );
}

async function scheduleFor(d: Decision): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: d.id, // 결정당 1개 — 재스케줄 시 자동 대체
    content: {
      title: '후속 확인',
      body: d.userSummary ?? d.summary,
      data: { decisionId: d.id, url: '/(tabs)/inbox' },
    },
    trigger: {
      // followUpAt은 shouldSchedule에서 non-null 보장
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(d.followUpAt as number),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelFollowUp(decisionId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(decisionId);
  } catch (e) {
    // 예약된 알림이 없으면 무시(멱등)
    console.warn('[notif] cancel skipped', decisionId, e);
  }
}

// 단일 결정의 현재 상태에 맞춰 스케줄/취소를 정합화(확정·수정·follow_up 변경 후 호출).
export async function syncFollowUpForDecision(
  db: SQLiteDatabase,
  decisionId: string,
): Promise<void> {
  try {
    const settings = await getSettings(db);
    if (!settings.notificationsEnabled) {
      await cancelFollowUp(decisionId);
      return;
    }
    const decision = await getDecision(db, decisionId);
    if (decision && shouldSchedule(decision, nowMs())) {
      await scheduleFor(decision);
    } else {
      await cancelFollowUp(decisionId);
    }
  } catch (e) {
    console.warn('[notif] sync failed', decisionId, e);
  }
}

// 부트/토글 시 전체 재동기화 — 앱이 예약한 모든 알림을 지우고 미래 follow-up만 다시 건다.
// getActiveUpcomingDecisions는 confirmed/edited·미완료·결과없음·(follow_up NULL or >now)만 반환한다.
export async function resyncFollowUpNotifications(db: SQLiteDatabase): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const settings = await getSettings(db);
    if (!settings.notificationsEnabled) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await ensureAndroidChannel();
    const now = nowMs();
    const active = await getActiveUpcomingDecisions(db, now);
    for (const decision of active) {
      if (shouldSchedule(decision, now)) await scheduleFor(decision);
    }
  } catch (e) {
    console.warn('[notif] resync failed', e);
  }
}


// ── 개발/테스트 전용 헬퍼 (DevToolsSection) ──────────────────────────────────

// N초 뒤 1회성 테스트 알림. 권한은 호출부에서 requestNotificationPermission로 먼저 확보한다.
export async function scheduleTestNotification(seconds = 10): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: '테스트 알림', body: `${seconds}초 뒤 발송된 테스트 알림입니다.`, data: { url: '/(tabs)/inbox' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: CHANNEL_ID,
    },
  });
}

export async function getScheduledNotificationCount(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
