import type { SttService, TranscribeOptions, TranscriptResult } from './types';

/**
 * OpenAI Whisper API 구현체 (ADR-002).
 * Phase 2에서 구현. 현재는 인터페이스 준수 확인용 stub.
 */
export class WhisperSttService implements SttService {
  transcribe(_audioPath: string, _options?: TranscribeOptions): Promise<TranscriptResult> {
    throw new Error('not implemented');
  }

  getEngineInfo(): { name: string; version: string } {
    return { name: 'whisper', version: '1' };
  }
}
