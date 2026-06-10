import type { SttService } from './types';
import { whisperSttService } from './whisper';

export type { SttService, TranscribeOptions, TranscriptResult, TranscriptSegment } from './types';

let _instance: SttService | null = null;

/**
 * SttService 팩토리 (ADR-002: 인터페이스로 추상화).
 * 현재는 항상 whisperSttService 반환.
 * 추후 settings.sttEngine 값에 따라 구현체 교체 예정.
 */
export function getSttService(): SttService {
  if (!_instance) {
    _instance = whisperSttService;
  }
  return _instance;
}
