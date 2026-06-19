/**
 * 월 단위 zip 내보내기 (영상 관리 P5, 선택).
 *
 * 한 달치 로컬 미디어 폴더(`entries/YYYY/MM/`)를 통째로 zip으로 묶어 OS 공유 시트로
 * 내보낸다. 사용자는 "파일에 저장" 등으로 외부 저장장치/드라이브에 보관할 수 있다.
 *
 * 왜 이 방식인가:
 * - zip은 로컬 디스크에 스트리밍으로 생성되므로(react-native-zip-archive 네이티브),
 *   원본을 통째로 메모리에 올리지 않는다(P2의 SAF bytesSync 메모리 한계 회피).
 * - 공유 시트(expo-sharing)는 로컬 file:// URI만 받으며, 대상 저장은 OS가 처리하므로
 *   대용량 파일을 앱이 직접 SAF로 바이트 복사할 필요가 없다.
 *
 * ⚠️ 네이티브 모듈(react-native-zip-archive)을 쓰므로 의존성 설치 + Dev Client
 *    재빌드가 필요하다(`npm install` → `npm run prebuild` → 재빌드). 묶이는 대상은
 *    그 달의 original/compressed/thumbnail 전부 — "월 폴더 통째 백업".
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';

// react-native-zip-archive는 java.io.File 기반 경로를 받으므로 file:// 스킴을 제거한다.
function stripScheme(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

// month: 'YYYY-MM'
export async function exportMonthZip(month: string): Promise<void> {
  const [yyyy, mm] = month.split('-');
  if (!yyyy || !mm) throw new Error(`잘못된 월 형식: ${month}`);

  const monthDir = new Directory(Paths.document, `entries/${yyyy}/${mm}`);
  if (!monthDir.exists) {
    throw new Error('해당 월의 로컬 파일이 없습니다.');
  }

  const targetFile = new File(Paths.cache, `SnackShot-${month}.zip`);
  if (targetFile.exists) targetFile.delete(); // 이전 산출물 제거(중복 방지)

  // 로컬→로컬 zip (디스크 스트리밍). 반환은 생성된 zip 경로.
  await zip(stripScheme(monthDir.uri), stripScheme(targetFile.uri));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('이 기기에서 공유를 사용할 수 없습니다.');
  }
  await Sharing.shareAsync(targetFile.uri, {
    mimeType: 'application/zip',
    dialogTitle: `${month} 백업`,
  });
}
