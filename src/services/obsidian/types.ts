import type { Directory } from 'expo-file-system';

import type { Decision, Entry, Outcome, Transcript } from '@/types/domain';

export interface DecisionExportItem {
  decision: Decision;
  outcome: Outcome | null;
}

export interface DayExportItem {
  entry: Entry;
  transcript: Transcript | null;
  /** confirmed/edited 결정만. rejected/extracted 포함 금지 (ADR-006/014). */
  decisions: DecisionExportItem[];
}

export interface ObsidianExportService {
  /**
   * 논리적 하루(logicalDate, 'yyyy-MM-dd') 전체를 vault에 export한다.
   * 데일리 노트 1개를 통째로 재생성하므로 멱등 — 같은 날을 몇 번
   * 재실행해도 중복 없이 클립이 시간순으로 이어 붙는다.
   */
  exportDay(vaultDir: Directory, logicalDate: string, items: DayExportItem[]): void;
}
