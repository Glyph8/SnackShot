/**
 * 마이그레이션 러너.
 * - PRAGMA user_version으로 현재 버전 추적
 * - 부족한 버전을 순차 적용, 각 버전은 트랜잭션 안에서 (실패 시 롤백)
 * - 스키마 변경과 user_version 갱신을 같은 트랜잭션에 묶어 원자성 보장
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS, TARGET_VERSION } from '@/db/schema';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion === TARGET_VERSION) {
    console.log(`[migrations] up-to-date at v${currentVersion}`);
    return;
  }
  if (currentVersion > TARGET_VERSION) {
    throw new Error(
      `[migrations] DB v${currentVersion} > TARGET v${TARGET_VERSION}. ` +
        `Downgrade not supported.`,
    );
  }

  console.log(
    `[migrations] upgrading v${currentVersion} -> v${TARGET_VERSION}`,
  );

  for (let v = currentVersion + 1; v <= TARGET_VERSION; v++) {
    const statements = MIGRATIONS[v];
    if (!statements) {
      throw new Error(`[migrations] no SQL for version ${v}`);
    }

    console.log(
      `[migrations] applying v${v} (${statements.length} statements)`,
    );

    // 스키마 + user_version 갱신을 단일 트랜잭션으로 묶음.
    // PRAGMA는 파라미터 바인딩 불가 → 인라인.
    await db.withTransactionAsync(async () => {
      for (const sql of statements) {
        await db.execAsync(sql);
      }
      await db.execAsync(`PRAGMA user_version = ${v}`);
    });

    console.log(`[migrations] v${v} applied`);
  }

  console.log(`[migrations] done at v${TARGET_VERSION}`);
}
