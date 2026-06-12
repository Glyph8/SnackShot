import { format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Linking } from 'react-native';

import { getSettings } from '@/db';
import { getVaultFolderName } from '@/services/obsidian';

/**
 * entry의 recordedAt 기준 논리적 날짜 노트를 옵시디언에서 연다 (ADR-026).
 * vault 미연결이면 no-op. 옵시디언 미설치 시 Alert.
 */
export async function openEntryInObsidian(
  db: SQLiteDatabase,
  recordedAt: number,
): Promise<void> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) return;

  const logicalDate = format(
    new Date(recordedAt - settings.dayBoundaryHour * 3_600_000),
    'yyyy-MM-dd',
  );
  const vaultName = getVaultFolderName(settings.obsidianVaultUri);
  const file = `SnackShot/entries/${logicalDate.slice(0, 4)}/${logicalDate.slice(5, 7)}/${logicalDate}`;
  const url = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(file)}`;

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('옵시디언 열기 실패', '이 기기에 옵시디언 앱이 설치되어 있지 않습니다.');
  }
}
