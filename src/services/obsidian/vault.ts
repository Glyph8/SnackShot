/**
 * Vault 연결·확인 유틸 (ADR-026 1단계).
 * SAF 폴더 선택, 초기 폴더 생성, 권한 확인을 담당한다.
 */

import { format } from 'date-fns';
import { Directory, File } from 'expo-file-system';

import type { Entry } from '@/types/domain';

// Directory.createFile은 구현체에 존재하지만 공식 타입에 미포함 (SDK 55)
export type SAFDir = Directory & {
  createFile(name: string, mimeType: string | null): File;
};

/**
 * 시스템 SAF 폴더 피커를 열어 Directory를 반환한다.
 * 취소 시 null. 내부적으로 takePersistableUriPermission 자동 호출.
 */
export async function pickVaultDirectory(): Promise<Directory | null> {
  try {
    return await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
}

/**
 * SAF/file URI에서 표시용 폴더 이름 추출.
 * SAF URI: content://.../tree/primary%3AObsidian → "Obsidian"
 */
export function getVaultFolderName(vaultUri: string): string {
  const decoded = decodeURIComponent(vaultUri).replace(/\/+$/, '');
  return decoded.split(/[/:]/).filter(Boolean).pop() ?? 'Unknown';
}

/**
 * 저장된 URI의 SAF 퍼미션이 유효한지 확인한다 (앱 재시작 후 검사용).
 */
export function checkVaultPermission(vaultUri: string): boolean {
  try {
    return new Directory(vaultUri).exists;
  } catch {
    return false;
  }
}

/**
 * vault 루트에 SnackShot/ 폴더와 초기 파일을 생성한다.
 * 이미 존재하면 재사용 (idempotent).
 */
export function setupSnackShotFolder(vaultDir: Directory): void {
  const dir = vaultDir as SAFDir;
  const snackShotDir = safGetOrCreateDir(dir, 'SnackShot');
  safGetOrCreateFile(snackShotDir, '.gitignore', 'text/plain').write('media/*.mp4\n');
  safGetOrCreateFile(snackShotDir, 'README.md', 'text/markdown').write('이 폴더는 SnackShot 앱이 관리합니다.\n');
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

/**
 * parent URI에서 name 서브아이템의 tree-doc URI를 구성한다.
 * ExternalStorageProvider 전용 (path-based document ID 가정).
 *
 * tree-doc URI를 사용하는 이유:
 * - SingleDocumentFile(single-doc URI)은 AndroidX 1.1.0에서 createDirectory/createFile/listFiles를
 *   모두 UnsupportedOperationException으로 throw한다.
 * - TreeDocumentFile(tree-doc URI)은 createDirectory/createFile/isDirectory/isFile이 정상 동작한다.
 *   SAFDocumentFile.kt는 pathSegments[0]=="tree"이면 fromTreeUri()를 호출하고,
 *   fromTreeUri()는 isDocumentUri 체크로 올바른 subdirectory의 TreeDocumentFile을 반환한다.
 *
 * tree root URI:  content://auth/tree/treeId
 * tree-doc URI:   content://auth/tree/treeId/document/docId
 * → 자식:         content://auth/tree/treeId/document/docId%2Fname
 */
export function buildChildTreeDocUri(parentUri: string, name: string): string | null {
  const stripped = parentUri.replace(/\/+$/, '');

  // tree-doc URI: content://authority/tree/treeId/document/docId
  const dm = stripped.match(/^(content:\/\/[^/]+\/tree\/[^/]+)\/document\/(.+)$/);
  if (dm) {
    const treeBase = dm[1];
    const childDocId = encodeURIComponent(decodeURIComponent(dm[2]) + '/' + name);
    return `${treeBase}/document/${childDocId}`;
  }

  // tree root URI: content://authority/tree/treeId (vault 최초 연결 시)
  const rm = stripped.match(/^(content:\/\/[^/]+\/tree\/([^/]+))$/);
  if (rm) {
    const treeBase = rm[1];
    const childDocId = encodeURIComponent(decodeURIComponent(rm[2]) + '/' + name);
    return `${treeBase}/document/${childDocId}`;
  }

  return null;
}

/**
 * SAF 디렉토리에서 name 서브디렉토리를 가져오거나 생성한다 (idempotent).
 *
 * list() 사용 금지: AndroidX documentfile 1.1.0의 SingleDocumentFile.listFiles()가 throw.
 * 대신 buildChildTreeDocUri + Directory.exists로 존재 확인.
 *
 * tree-doc URI를 유지하는 이유: SAFDocumentFile.kt의 fromTreeUri()가 isDocumentUri 체크를
 * 통해 올바른 subdirectory의 TreeDocumentFile을 반환한다. TreeDocumentFile은 createDirectory/
 * createFile이 정상 동작하므로 중첩 호출에서도 올바른 위치에 생성된다.
 * single-doc URI로 변환하면 모든 write 계열 메서드가 throw한다.
 */
export function safGetOrCreateDir(parent: SAFDir, name: string): SAFDir {
  const parentUri = (parent as Directory).uri;
  const childUri = buildChildTreeDocUri(parentUri, name);
  if (childUri) {
    const existing = new Directory(childUri);
    if (existing.exists) {
      return existing as SAFDir;
    }
  }
  const created = parent.createDirectory(name);
  return created as SAFDir;
}

/**
 * SAF 디렉토리에서 name 파일을 가져오거나 생성한다 (idempotent).
 *
 * FileSystemFile.exists가 single-doc URI에서 신뢰할 수 없으므로 createFile 후
 * 반환된 파일 이름을 비교해 중복 생성 여부를 판단한다:
 * - 이름 일치: 새로 생성됨 → 반환
 * - 이름 불일치 (Android이 "name (N)" 중복 생성): 원본이 이미 존재 → 중복 삭제 후 원본 URI 반환
 */
export function safGetOrCreateFile(parent: SAFDir, name: string, mimeType: string): File {
  const parentUri = (parent as Directory).uri;
  const created = parent.createFile(name, mimeType);
  // tree-doc URI는 trailing slash 없음 (FileSystemFile.asString()은 slash를 제거)
  const createdName = decodeURIComponent(created.uri).split('/').pop() ?? '';

  if (createdName === name) {
    return created;
  }

  // Android이 "(N)" suffix 중복 파일 생성 — 원본이 이미 존재
  try { created.delete(); } catch { /* ignore */ }

  const childUri = buildChildTreeDocUri(parentUri, name);
  if (childUri) {
    return new File(childUri);
  }
  // fallback: URI 구성 불가 (non-ExternalStorageProvider) — 중복 반환
  return created;
}

// ─── ADR-026 3단계: vault 미디어 정리 ─────────────────────────────────────────

/**
 * vault의 entry 미디어 파일을 삭제한다 (idempotent).
 *
 * 경로: SnackShot/media/YYYY/MM/<entryId>.{mp4,jpg,m4a}
 * - voice/silent: mp4 + jpg(썸네일)
 * - audio: m4a
 *
 * SAF tree-doc URI를 buildChildTreeDocUri로 구성한 뒤 File.exists 체크 후
 * File.delete()를 호출한다. 파일이 없거나 권한이 만료된 경우 console.warn 후
 * 계속 진행 — 호출자(엔트리 삭제 흐름)가 중단되면 안 된다.
 *
 * YYYY/MM은 entry.recordedAt 기준 로컬 타임존으로 계산. boundaryHour를
 * 적용하지 않는 이유: export.ts가 logicalDate로 폴더를 결정하므로 월 경계
 * 새벽 케이스에서 실제 파일과 1개월 어긋날 수 있다. 그래도 idempotent하게
 * 동작하려면 호출자가 같은 규칙으로 폴더를 식별해야 한다. 본 함수는
 * recordedAt 기준 단순 추출 — 일치하지 않으면 파일이 없어 무시되어 안전.
 */
export function deleteEntryMediaFromVault(vaultDir: Directory, entry: Entry): void {
  const yyyy = format(new Date(entry.recordedAt), 'yyyy');
  const mm = format(new Date(entry.recordedAt), 'MM');

  // SnackShot/media/YYYY/MM tree-doc URI를 단계적으로 구성
  const vaultUri = vaultDir.uri;
  const snackUri = buildChildTreeDocUri(vaultUri, 'SnackShot');
  if (!snackUri) return;
  const mediaUri = buildChildTreeDocUri(snackUri, 'media');
  if (!mediaUri) return;
  const yearUri = buildChildTreeDocUri(mediaUri, yyyy);
  if (!yearUri) return;
  const monthUri = buildChildTreeDocUri(yearUri, mm);
  if (!monthUri) return;

  const names: string[] = [];
  if (entry.mode === 'voice' || entry.mode === 'silent') {
    names.push(`${entry.id}.mp4`, `${entry.id}.jpg`);
  } else if (entry.mode === 'audio') {
    names.push(`${entry.id}.m4a`);
  }

  for (const name of names) {
    const childUri = buildChildTreeDocUri(monthUri, name);
    if (!childUri) continue;
    try {
      const f = new File(childUri);
      if (f.exists) f.delete();
    } catch (e) {
      console.warn(`[obsidian] deleteEntryMediaFromVault failed for ${name}:`, e);
    }
  }
}
