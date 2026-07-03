import { Directory } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSettings } from '@/db';

import { readVaultTextFile } from './vault';

// E3(a): vault SnackShot/Profile.md 를 AI 참고 맥락으로 읽는다. 설정 토글 없음 — 파일 있으면 사용, 지우면 꺼짐.
// ⚠️ 프라이버시: 이 내용은 결정 추출·작성 시 Gemini API로 전송된다(전사와 동일 범주).
//    Profile.md 템플릿(setupSnackShotFolder) 헤더에 이 사실을 명시한다.

const MAX_PROFILE_CHARS = 2000;

export async function readUserProfile(db: SQLiteDatabase): Promise<string | null> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) return null;
  const raw = readVaultTextFile(new Directory(settings.obsidianVaultUri), 'Profile.md');
  if (raw == null) return null;
  // HTML 주석(안내 헤더) 제거 후 실제 본문만. 템플릿만 있으면 빈 문자열 → 사용 안 함.
  const body = raw.split('\n').filter((l) => !/^\s*<!--.*-->\s*$/.test(l)).join('\n').trim();
  if (!body) return null;
  if (body.length > MAX_PROFILE_CHARS) {
    console.warn(`[profile] Profile.md ${body.length}자 — 앞 ${MAX_PROFILE_CHARS}자만 사용`);
    return body.slice(0, MAX_PROFILE_CHARS);
  }
  return body;
}
