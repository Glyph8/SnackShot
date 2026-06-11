import type { Directory } from 'expo-file-system';

import type { Entry, Transcript } from '@/types/domain';

export interface ObsidianExportService {
  /**
   * 단일 entry를 vault에 마크다운 + 미디어로 export한다.
   * 동일 entry 재실행 시 기존 파일을 덮어쓴다 (멱등).
   */
  exportEntry(vaultDir: Directory, entry: Entry, transcript: Transcript | null): void;
}
