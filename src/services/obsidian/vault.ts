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
 * SAF node(Directory/File)의 존재 여부를 안전하게 확인한다.
 * 일부 provider/URI에서는 `.exists` 접근 자체가 throw하므로 try/catch로 감싼다.
 */
export function safSafeExists(node: Directory | File): boolean {
  try {
    return node.exists;
  } catch {
    return false;
  }
}

/**
 * vault 디렉토리가 실제로 존재하고 SAF 쓰기 권한이 유지되는지 확인한다.
 *
 * 폴더가 이동/삭제되었거나 SAF persistable 권한이 만료된 상태로 write를 시도하면
 * 네이티브에서 "create function does not work with SAF Uris" 같은 모호한 에러가
 * 난다. 그 전에 여기서 명확한 한국어 메시지로 throw해 호출자(설정 화면)가
 * 사용자에게 "폴더를 다시 선택" 안내를 띄울 수 있게 한다.
 */
export function assertVaultWritable(vaultDir: Directory): void {
  if (!vaultDir?.uri) {
    throw new Error('Vault 경로가 유효하지 않습니다. 폴더를 다시 선택해주세요.');
  }
  if (!safSafeExists(vaultDir)) {
    throw new Error(
      'Vault 폴더에 접근할 수 없습니다. SAF 권한이 만료되었거나 폴더가 이동/삭제되었습니다. 폴더를 다시 선택해주세요.',
    );
  }
}

/**
 * vault 루트에 SnackShot/ 폴더와 초기 파일을 생성한다.
 * 이미 존재하면 재사용 (idempotent).
 *
 * write 전에 assertVaultWritable로 권한·존재를 먼저 확인한다 (방어적).
 */
export function setupSnackShotFolder(vaultDir: Directory): void {
  assertVaultWritable(vaultDir);
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
    if (safSafeExists(existing)) {
      // 디렉토리는 재사용 시 createFile/createDirectory로 "탐색"만 하므로
      // raw tree-doc URI 핸들을 그대로 반환해도 안전하다 (write 대상 아님).
      return existing as SAFDir;
    }
  }
  // 존재하지 않을 때만 생성. createDirectory는 SAF-native 핸들을 반환한다.
  const created = parent.createDirectory(name);
  return created as SAFDir;
}

/**
 * SAF 디렉토리에 name 파일의 "쓰기 가능한" 핸들을 보장해 반환한다 (idempotent).
 *
 * ⚠️ SAF 핵심 제약 (이번 버그의 근본 원인):
 *   raw URI로 만든 File(`new File(safUri)`)에 `.write()`를 호출하면 네이티브가
 *   내부적으로 `create()`를 먼저 호출하는데, SAF document URI에서는 create가
 *   지원되지 않아 다음 에러로 throw한다:
 *     "Unable to create file or directory: create function does not work with
 *      SAF Uris, use `createDirectory` and `createFile` instead"
 *   따라서 write 대상 File은 반드시 `parent.createFile()`이 반환한 SAF-native
 *   핸들이어야 한다. 기존 코드는 중복 처리 경로에서 `new File(childUri)`(raw URI)를
 *   반환했고, 재연결/재export처럼 파일이 이미 존재하는 실기기 시나리오에서
 *   그 핸들에 write하다 위 에러로 충돌했다.
 *
 * 멱등성 전략:
 *   같은 이름 파일이 이미 있으면 createFile은 "name (1)" 중복을 만든다. 이를 막기
 *   위해 tree-doc URI로 기존 파일 존재를 확인하고, 있으면 먼저 삭제한 뒤 새로
 *   생성한다. 데일리 노트·README는 매번 통째로 재작성하는 의미이므로 삭제-재생성이
 *   올바르며, 항상 쓰기 가능한 핸들을 보장한다.
 *
 * ⚠️ MIME 확장자 강제 부착 (실기기 버그, 2026-06-12):
 *   SAF createDocument는 표시 이름의 확장자가 mimeType과 일치하지 않으면 확장자를
 *   덧붙인다 (AOSP FileUtils.buildUniqueFile). '.gitignore'+text/plain은 lastDot==0
 *   탓에 "확장자 gitignore"로 파싱되어 '.gitignore.txt'가 생성되고, 아래 이름 검증이
 *   이를 중복 충돌로 오인해 throw했다. mimeType이 application/octet-stream이면
 *   부착 로직을 타지 않으므로, 이름 불일치 시 octet-stream으로 1회 재시도한다.
 *   (expo는 mimeType null을 'text/plain'으로 치환하므로 null로는 못 피한다.)
 */
export function safGetOrCreateFile(parent: SAFDir, name: string, mimeType: string): File {
  const parentUri = (parent as Directory).uri;
  const childUri = buildChildTreeDocUri(parentUri, name);

  // 기존 동명 파일이 있으면 먼저 삭제 → createFile이 "(N)" 중복을 만들지 않게 한다.
  if (childUri) {
    const existing = new File(childUri);
    if (safSafeExists(existing)) {
      try {
        existing.delete();
      } catch (e) {
        console.warn(`[obsidian] 기존 파일 삭제 실패 (${name}):`, e);
      }
    }
  }

  // createFile은 쓰기 가능한 SAF-native File 핸들을 반환한다.
  // 이름 불일치(확장자 부착 또는 "name (N)" 중복) 시 1회 octet-stream 재시도.
  let created = safCreateFileExactName(parent, name, mimeType);
  if (!created && mimeType !== 'application/octet-stream') {
    created = safCreateFileExactName(parent, name, 'application/octet-stream');
  }
  if (!created) {
    throw new Error(
      `SAF 파일 생성 충돌: '${name}' 을(를) 의도한 이름으로 생성할 수 없습니다. 동명 파일이 남아 있거나 provider가 이름을 변경했습니다. 폴더 권한을 확인하거나 폴더를 다시 선택해주세요.`,
    );
  }
  return created;
}

/**
 * createFile 후 실제 생성된 이름이 요청한 이름과 같은지 검증한다.
 * 다르면(확장자 부착, "(N)" 중복) 생성물을 지우고 null을 반환해 호출자가 재시도하게 한다.
 * tree-doc URI는 trailing slash 없음 (FileSystemFile.asString()은 slash를 제거).
 */
function safCreateFileExactName(parent: SAFDir, name: string, mimeType: string): File | null {
  const created = parent.createFile(name, mimeType);
  const createdName = decodeURIComponent(created.uri).replace(/\/+$/, '').split('/').pop() ?? '';
  if (createdName === name) return created;
  try { created.delete(); } catch { /* ignore */ }
  return null;
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
