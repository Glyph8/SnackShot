import { Directory } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSettings } from '@/db';

import {
  PROFILE_TEMPLATE_HEADER,
  assertVaultWritable,
  readVaultTextFile,
  safGetOrCreateDir,
  safGetOrCreateFile,
  type SAFDir,
} from './vault';

// E3(a): vault SnackShot/Profile.md 를 AI 참고 맥락으로 읽는다. 설정 토글 없음 — 파일 있으면 사용, 지우면 꺼짐.
// ⚠️ 프라이버시: 이 내용은 결정 추출·작성 시 Gemini API로 전송된다(전사와 동일 범주).
//    Profile.md 템플릿(setupSnackShotFolder) 헤더에 이 사실을 명시한다.
//
// 설정 화면 편집기 연동:
//   - loadProfileForEdit: 파일 → 편집기 (안내 주석 제거한 본문만).
//   - saveUserProfile:    편집기 → 파일 덮어쓰기 (안내 헤더 + 본문).

export const MAX_PROFILE_CHARS = 2000;

// Profile.md 상단 안내 주석(HTML comment) 라인을 제거하고 실제 본문만 남긴다.
function stripProfileComments(raw: string): string {
  return raw
    .split('\n')
    .filter((l) => !/^\s*<!--.*-->\s*$/.test(l))
    .join('\n')
    .trim();
}

export async function readUserProfile(db: SQLiteDatabase): Promise<string | null> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) return null;
  const raw = readVaultTextFile(new Directory(settings.obsidianVaultUri), 'Profile.md');
  if (raw == null) return null;
  // HTML 주석(안내 헤더) 제거 후 실제 본문만. 템플릿만 있으면 빈 문자열 → 사용 안 함.
  const body = stripProfileComments(raw);
  if (!body) return null;
  if (body.length > MAX_PROFILE_CHARS) {
    console.warn(`[profile] Profile.md ${body.length}자 — 앞 ${MAX_PROFILE_CHARS}자만 사용`);
    return body.slice(0, MAX_PROFILE_CHARS);
  }
  return body;
}

/**
 * 설정 편집기용: 기존 Profile.md 본문을 읽어 반환한다(안내 주석 제거).
 * - 볼트 미연결: null (편집기가 '옵시디언 필요' 상태를 표시).
 * - 볼트 연결·파일 없음/빈 파일: '' (편집기 비어 있음, 저장 시 새로 생성).
 */
export async function loadProfileForEdit(db: SQLiteDatabase): Promise<string | null> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) return null;
  const raw = readVaultTextFile(new Directory(settings.obsidianVaultUri), 'Profile.md');
  if (raw == null) return '';
  return stripProfileComments(raw);
}

/**
 * 설정 편집기용: 편집기 본문으로 Profile.md 전체를 덮어쓴다(안내 헤더 + 본문).
 * - 볼트 미연결: throw (호출자가 안내 표시).
 * - 본문이 비면 헤더만 남긴다 → readUserProfile은 null(프로필 미사용)로 해석.
 */
export async function saveUserProfile(db: SQLiteDatabase, body: string): Promise<void> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) {
    throw new Error('옵시디언 볼트가 연결되지 않았습니다. 먼저 폴더를 연결해주세요.');
  }
  const vaultDir = new Directory(settings.obsidianVaultUri);
  assertVaultWritable(vaultDir);
  const snackShotDir = safGetOrCreateDir(vaultDir as SAFDir, 'SnackShot');
  const trimmed = body.trim().slice(0, MAX_PROFILE_CHARS);
  const content = trimmed ? `${PROFILE_TEMPLATE_HEADER}${trimmed}\n` : PROFILE_TEMPLATE_HEADER;
  safGetOrCreateFile(snackShotDir, 'Profile.md', 'text/markdown').write(content);
}
