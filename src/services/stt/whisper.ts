import { File } from 'expo-file-system';

import { DEFAULT_OPENAI_MODEL, getOpenAIKey, getOpenAIModel } from '@/lib/env';

import { WhisperVerboseResponseSchema } from './schema';
import type { SttService, TranscribeOptions, TranscriptResult } from './types';

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const TIMEOUT_MS = 180_000;

// getEngineInfo(동기)에서 마지막 사용 모델을 반환하기 위한 캐시
let lastModel = DEFAULT_OPENAI_MODEL;
// Whisper API 업로드 한도: 25MB
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// Whisper API 단가: $0.006 / 분
const COST_PER_MIN = 0.006;

async function transcribe(
  audioPath: string,
  options?: TranscribeOptions,
): Promise<TranscriptResult> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    throw new Error('[Whisper] API 키 없음. 설정 화면에서 OpenAI 키를 입력하세요.');
  }

  // 업로드 전 25MB 한도 가드 — 초과 시 잡 last_error에 사람이 읽을 메시지로 기록
  const sizeBytes = new File(audioPath).size;
  if (sizeBytes != null && sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(
      `[Whisper] 파일이 25MB 한도 초과 (${(sizeBytes / 1024 / 1024).toFixed(1)}MB) — STT 불가`,
    );
  }

  const model = await getOpenAIModel();
  lastModel = model;
  // whisper-1만 verbose_json(segment·duration·logprob) 지원. gpt-4o 계열은 json(텍스트) 사용.
  const verbose = model === 'whisper-1';

  const formData = new FormData();
  // React Native FormData는 { uri, type, name } 형태의 파일 객체를 지원함
  // audio/mp4 타입 지정 — video/mp4로 전송 시 Whisper가 오디오 트랙을 인식 못하는 경우 있음
  formData.append('file', { uri: audioPath, type: 'audio/mp4', name: 'recording.mp4' } as unknown as Blob);
  formData.append('model', model);
  formData.append('language', options?.language ?? 'ko');
  formData.append('response_format', verbose ? 'verbose_json' : 'json');
  // temperature=0 — 내부 temperature fallback로 인한 환각(뜬금없는 대사) 억제
  if (verbose) formData.append('temperature', '0');
  if (options?.prompt) formData.append('prompt', options.prompt);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`[Whisper] 네트워크 오류: ${msg}`);
  } finally {
    clearTimeout(timeoutId);
  }

  await assertOk(response);

  const raw: unknown = await response.json();

  // gpt-4o 계열: json 응답({ text }) — segment/duration 없음
  if (!verbose) {
    const text = (raw as { text?: string })?.text?.trim();
    if (!text) {
      console.error('[Whisper] 빈 응답:', raw);
      throw new Error('[Whisper] 응답 형식 오류');
    }
    console.log(`[Whisper] model=${model} chars=${text.length}`);
    return { text, language: options?.language ?? 'ko', confidence: undefined };
  }

  const parsed = WhisperVerboseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Whisper] 응답 스키마 불일치:', parsed.error.issues);
    throw new Error('[Whisper] 응답 형식 오류');
  }

  const data = parsed.data;

  // 무음/저음성 환각 세그먼트 제거 — "뜬금없는 대사"의 원인.
  //  - no_speech_prob 높고 avg_logprob 낮음 → 실제로는 무음
  //  - compression_ratio 높음 → 반복/깨진 출력
  //  - avg_logprob 극저 → 신뢰 불가
  const kept = data.segments.filter((s) => {
    const nsp = s.no_speech_prob ?? 0;
    const alp = s.avg_logprob ?? 0;
    const cr = s.compression_ratio ?? 1;
    if (nsp > 0.6 && alp < -1.0) return false;
    if (cr > 2.4) return false;
    if (alp < -1.5) return false;
    return true;
  });
  const dropped = data.segments.length - kept.length;

  const costUSD = (data.duration / 60) * COST_PER_MIN;
  console.log(
    `[Whisper] duration=${data.duration.toFixed(1)}s lang=${data.language} ` +
    `segments=${data.segments.length}(−${dropped} 환각) cost≈$${costUSD.toFixed(4)}`,
  );

  // 살아남은 세그먼트로 본문 재구성 (환각 구간 제외)
  const text = kept.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();

  // avg_logprob (log 확률, ≤0) → [0, 1] 신뢰도
  const logprobSum = kept.reduce((sum, s) => sum + (s.avg_logprob ?? 0), 0);
  const confidence = kept.length > 0
    ? Math.max(0, Math.min(1, Math.exp(logprobSum / kept.length)))
    : undefined;

  return {
    text,
    language: data.language,
    confidence,
    segments: kept.map((s) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
    })),
  };
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  if (res.status === 401) throw new Error('[Whisper] API 키 인증 실패 (401) — 키를 확인하세요.');
  if (res.status === 429) throw new Error('[Whisper] 요청 한도 초과 (429) — 잠시 후 재시도하세요.');
  if (res.status >= 500) throw new Error(`[Whisper] 서버 오류 (${res.status})`);
  throw new Error(`[Whisper] 요청 실패 (${res.status}): ${body}`);
}

// 함수형 서비스 객체 (CLAUDE.md: 클래스/DI 금지)
export const whisperSttService: SttService = {
  transcribe,
  getEngineInfo: () => ({ name: 'openai-stt', version: lastModel }),
};
