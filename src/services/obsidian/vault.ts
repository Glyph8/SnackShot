/**
 * Vault 연결·확인 유틸 (ADR-026 1단계).
 * SAF 폴더 선택, 초기 폴더 생성, 권한 확인을 담당한다.
 */

import { Directory, File } from 'expo-file-system';

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
 * tree-format SAF URI → single-doc URI 정규화.
 * content://auth/tree/treeId/document/docId → content://auth/document/docId
 *
 * SAFDocumentFile.kt는 pathSegments[0]=="tree"이면 fromTreeUri()를 사용한다.
 * fromTreeUri()는 getTreeDocumentId()로 /tree/treeId만 추출하고 /document/docId를 무시 →
 * 이후 createDirectory/createFile이 vault root에서 실행되는 버그.
 * single-doc URI로 변환하면 fromSingleUri()가 올바른 문서를 가리킨다.
 */
function toSingleDocUri(uri: string): string {
  const stripped = uri.replace(/\/+$/, '');
  const m = stripped.match(/^(content:\/\/[^/]+)\/tree\/[^/]+\/document\/(.+)$/);
  return m ? `${m[1]}/document/${m[2]}` : stripped;
}

/**
 * ExternalStorageProvider 전용: parent URI에서 name 서브아이템의 single-doc URI를 구성한다.
 * path-based document ID (primary:path/to/item) 가정.
 *
 * Directory.exists는 isDirectory()를 사용하므로 single-doc URI에서도 올바르게 동작한다.
 * (FileSystemFile.exists는 isFile()을 사용하므로 non-existing single-doc URI에서 오진)
 *
 * 구성된 URI의 ':' 인코딩이 실제 Android URI와 다를 수 있지만 ContentProvider는
 * pathSegments 디코딩 후 처리하므로 exists/write 모두 올바르게 동작한다.
 */
function buildChildDocUri(parentUri: string, name: string): string | null {
  const stripped = parentUri.replace(/\/+$/, '');

  // single-doc URI: content://authority/document/docId
  const sm = stripped.match(/^(content:\/\/[^/]+)\/document\/(.+)$/);
  if (sm) {
    const docId = decodeURIComponent(sm[2]) + '/' + name;
    return `${sm[1]}/document/${encodeURIComponent(docId)}`;
  }

  // tree root URI: content://authority/tree/treeId (vault root)
  const tm = stripped.match(/^(content:\/\/[^/]+)\/tree\/([^/]+)$/);
  if (tm) {
    const docId = decodeURIComponent(tm[2]) + '/' + name;
    return `${tm[1]}/document/${encodeURIComponent(docId)}`;
  }

  return null;
}

/**
 * SAF 디렉토리에서 name 서브디렉토리를 가져오거나 생성한다 (idempotent).
 *
 * list() 사용 금지: AndroidX documentfile 1.1.0의 SingleDocumentFile.listFiles()가
 * UnsupportedOperationException을 throw한다. 대신 buildChildDocUri + Directory.exists.
 *
 * createDirectory 반환값을 single-doc URI로 변환하는 이유: 반환 URI가 tree-doc 형식이면
 * SAFDocumentFile.kt의 fromTreeUri()가 tree root를 반환해 이후 중첩 createDirectory가
 * 항상 vault root에 생성되는 버그가 발생한다. single-doc URI → fromSingleUri() → 올바른 위치.
 */
export function safGetOrCreateDir(parent: SAFDir, name: string): SAFDir {
  const parentUri = (parent as Directory).uri;
  const childUri = buildChildDocUri(parentUri, name);
  if (childUri) {
    const existing = new Directory(childUri);
    if (existing.exists) {
      return existing as SAFDir;
    }
  }
  const created = parent.createDirectory(name) as Directory;
  return new Directory(toSingleDocUri(created.uri)) as SAFDir;
}

/**
 * SAF 디렉토리에서 name 파일을 가져오거나 생성한다 (idempotent).
 *
 * FileSystemFile.exists가 single-doc URI에서 신뢰할 수 없으므로 (isFile()이 null MIME에
 * 대해 true 반환) createFile 후 반환된 파일 이름으로 판단한다:
 * - 이름 일치: 새로 생성됨 → 반환
 * - 이름 불일치 ("name (N)" 형식): Android이 중복 생성 → 중복 삭제 후 원본 URI 반환
 */
export function safGetOrCreateFile(parent: SAFDir, name: string, mimeType: string): File {
  const parentUri = (parent as Directory).uri;
  const created = parent.createFile(name, mimeType);
  const createdName = decodeURIComponent(created.uri).split('/').pop() ?? '';

  if (createdName === name) {
    return created;
  }

  // Android이 "(N)" suffix 중복 파일 생성 — 원본이 이미 존재
  try { created.delete(); } catch { /* ignore */ }

  const childUri = buildChildDocUri(parentUri, name);
  if (childUri) {
    return new File(childUri);
  }
  // fallback: URI 구성 불가 (non-ExternalStorageProvider) — 중복 반환
  return created;
}
