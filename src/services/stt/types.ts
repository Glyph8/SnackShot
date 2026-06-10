export interface TranscribeOptions {
  /** ISO 639-1 언어 코드. 미지정 시 자동 감지 */
  language?: string;
  /** Whisper에 전달할 프롬프트 힌트 (고유명사 등 오인식 보정용) */
  prompt?: string;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  language: string;
  confidence?: number;
  segments?: TranscriptSegment[];
}

export interface SttService {
  transcribe(audioPath: string, options?: TranscribeOptions): Promise<TranscriptResult>;
  getEngineInfo(): { name: string; version: string };
}
