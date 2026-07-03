import { Directory } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { enqueueJob, getSettings, insertTextEntry, setObsidianInboxLastHash } from '@/db';
import { nowMs } from '@/lib/time';
import {
  type SAFDir, readVaultTextFile, safGetOrCreateDir, safGetOrCreateFile,
} from '@/services/obsidian/vault';
import type { AiJob } from '@/types/domain';

// 옵시디언 → SnackShot 수신함 import (E1). 단방향 채널 — export(day note)와 독립.
// SnackShot/Inbox.md 를 읽어 '---' 구분 블록마다 text entry로 변환하고 파일을 헤더만 남기고 비운다.

const INBOX_FILE = 'Inbox.md';
const INBOX_HEADER = '<!-- 여기에 쓴 내용은 SnackShot이 가져갑니다. 블록 구분은 --- -->';
const EMPTIED = `${INBOX_HEADER}\n`;

// 단순 문자열 비교용 해시(djb2) — 암호학적 용도 아님(중복 방어).
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

// HTML 주석(헤더) 라인 제거 후 단독 '---' 라인으로 블록 분할. 공백 블록은 버린다.
function parseBlocks(content: string): string[] {
  const lines = content.split('\n').filter((l) => !/^\s*<!--.*-->\s*$/.test(l));
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (line.trim() === '---') { blocks.push(cur.join('\n').trim()); cur = []; }
    else cur.push(line);
  }
  blocks.push(cur.join('\n').trim());
  return blocks.filter((b) => b.length > 0);
}

export async function handleObsidianImport(_job: AiJob, db: SQLiteDatabase): Promise<void> {
  const settings = await getSettings(db);
  if (!settings.obsidianVaultUri) {
    console.log('[import] skip — vault 미연결');
    return;
  }
  const vaultDir = new Directory(settings.obsidianVaultUri);
  if (!vaultDir.exists) throw new Error('vault 접근 권한 만료 — 설정에서 다시 연결 필요');
  const snackShotDir = safGetOrCreateDir(vaultDir as SAFDir, 'SnackShot');

  const content = readVaultTextFile(vaultDir, INBOX_FILE);
  if (content == null) {
    // 최초 — 헤더만 생성하고 종료(다음부터 사용자가 이 파일에 쓴다).
    safGetOrCreateFile(snackShotDir, INBOX_FILE, 'text/markdown').write(EMPTIED);
    await setObsidianInboxLastHash(db, djb2(EMPTIED));
    console.log('[import] Inbox.md 최초 생성');
    return;
  }

  const hash = djb2(content);
  if (hash === settings.obsidianInboxLastHash) return; // 변화 없음

  const blocks = parseBlocks(content);
  if (blocks.length === 0) {
    await setObsidianInboxLastHash(db, hash); // 처리할 블록 없음 — 해시만 기록
    return;
  }

  const now = nowMs();
  for (const body of blocks) {
    const entry = await insertTextEntry(db, { recordedAt: now, body });
    // 기존 파이프라인 편입(compose-text와 동일): label 추출 + (자동export 시) export.
    await enqueueJob(db, 'label_extraction', entry.id, 'entries');
    if (settings.obsidianAutoExport) {
      await enqueueJob(db, 'obsidian_export', entry.id, 'entries');
    }
  }

  // 순서 확정: 저장 완료 → 파일 비우기 → last_hash 갱신(비운 내용 기준).
  // 비우기 실패 시 중복은 위 해시 비교가 막는다(반대 순서는 유실 위험이라 금지).
  safGetOrCreateFile(snackShotDir, INBOX_FILE, 'text/markdown').write(EMPTIED);
  await setObsidianInboxLastHash(db, djb2(EMPTIED));
  console.log(`[import] ${blocks.length}건 import 완료`);
}
