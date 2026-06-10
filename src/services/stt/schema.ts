import { z } from 'zod';

// Whisper verbose_json 응답 세그먼트
// avg_logprob: log(P(token)) 평균. 0에 가까울수록 높은 신뢰도
const SegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  avg_logprob: z.number().optional(),
  no_speech_prob: z.number().optional(),
  // 나머지 필드는 무시 (seek, tokens, temperature, compression_ratio)
}).passthrough();

export const WhisperVerboseResponseSchema = z.object({
  task: z.string().optional(),
  language: z.string(),
  duration: z.number(),
  text: z.string(),
  segments: z.array(SegmentSchema).default([]),
});

export type WhisperVerboseResponse = z.infer<typeof WhisperVerboseResponseSchema>;
export type WhisperSegment = z.infer<typeof SegmentSchema>;
