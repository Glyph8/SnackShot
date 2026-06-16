import { DEFAULT_GEMINI_MODEL, getGeminiKey, getGeminiModel } from '@/lib/env';

import {
  DECISION_EXTRACTION_SYSTEM_PROMPT,
  FEW_SHOT_EXAMPLES,
  buildUserMessage,
} from './prompts';
import { GeminiResponseSchema, RESPONSE_JSON_SCHEMA } from './schema';
import type { DecisionCandidate, ExtractHints, LabelResult, LabelService } from './types';

const TIMEOUT_MS = 30_000;

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// getEngineInfo(동기)에서 마지막 사용 모델 반환용 캐시
let lastModel = DEFAULT_GEMINI_MODEL;

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

function buildRequestBody(transcript: string, hints: ExtractHints, temperature: number) {
  const fewShotTurns = FEW_SHOT_EXAMPLES.flatMap((ex) => [
    { role: 'user', parts: [{ text: ex.user }] },
    // ex.model은 이미 JSON 문자열 — 재 stringify 금지
    { role: 'model', parts: [{ text: ex.model }] },
  ]);

  return {
    systemInstruction: {
      parts: [{ text: DECISION_EXTRACTION_SYSTEM_PROMPT }],
    },
    contents: [
      ...fewShotTurns,
      { role: 'user', parts: [{ text: buildUserMessage(transcript, hints) }] },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_JSON_SCHEMA,
      temperature,
    },
  };
}

async function callApi(
  apiKey: string,
  body: ReturnType<typeof buildRequestBody>,
  model: string,
): Promise<{ text: string; promptTokens: number; candidatesTokens: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpointFor(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`[Gemini] 네트워크 오류: ${msg}`);
  } finally {
    clearTimeout(timeoutId);
  }

  await assertOk(response);

  const raw: unknown = await response.json();
  const data = raw as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const promptTokens = data?.usageMetadata?.promptTokenCount ?? 0;
  const candidatesTokens = data?.usageMetadata?.candidatesTokenCount ?? 0;

  return { text, promptTokens, candidatesTokens };
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  if (res.status === 401) throw new Error('[Gemini] API 키 인증 실패 (401) — 키를 확인하세요.');
  if (res.status === 429) throw new Error('[Gemini] 요청 한도 초과 (429) — 잠시 후 재시도하세요.');
  if (res.status >= 500) throw new Error(`[Gemini] 서버 오류 (${res.status})`);
  throw new Error(`[Gemini] 요청 실패 (${res.status}): ${body}`);
}

function parseAndValidate(
  text: string,
  transcript: string,
): LabelResult {
  const raw: unknown = JSON.parse(text);
  const parsed = GeminiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Gemini] 응답 스키마 불일치:', parsed.error.issues);
    throw new Error('[Gemini] 응답 형식 오류');
  }

  // ADR-027 2번: evidence verbatim 검증 — 원문에 없는 evidence 후보 폐기
  const verified = parsed.data.decisions.filter((d): d is typeof d => {
    const ok = transcript.includes(d.evidence);
    if (!ok) {
      console.warn(`[Gemini] evidence 불일치로 후보 폐기: "${d.summary}" / evidence="${d.evidence}"`);
    }
    return ok;
  });

  const hasDecision = verified.length > 0;

  const candidates: DecisionCandidate[] = verified.map((d) => ({
    summary: d.summary,
    category: d.category,
    reasoning: d.reasoning,
    alternatives: d.alternatives,
    expectedOutcome: d.expectedOutcome,
    evidence: d.evidence,
    confidence: d.confidence,
    followUpAfterDays: d.followUpAfterDays,
  }));

  return { hasDecision, candidates };
}

// ─── 서비스 구현 ──────────────────────────────────────────────────────────────

async function extractDecisions(
  transcript: string,
  hints: ExtractHints,
): Promise<LabelResult> {
  const apiKey = await getGeminiKey();
  if (!apiKey) {
    throw new Error('[Gemini] API 키 없음. 설정 화면에서 Gemini 키를 입력하세요.');
  }
  const model = await getGeminiModel();
  lastModel = model;

  // 1차 시도 temperature=0.2
  const body = buildRequestBody(transcript, hints, 0.2);
  const { text, promptTokens, candidatesTokens } = await callApi(apiKey, body, model);
  console.log(
    `[Gemini] promptTokens=${promptTokens} candidatesTokens=${candidatesTokens}`,
  );

  try {
    return parseAndValidate(text, transcript);
  } catch {
    // ADR-027 5번: 파싱 실패 시 temperature=0.4로 1회 재시도
    console.warn('[Gemini] 파싱 실패, temperature=0.4로 재시도');
    const retryBody = buildRequestBody(transcript, hints, 0.4);
    const { text: retryText, promptTokens: rp, candidatesTokens: rc } = await callApi(apiKey, retryBody, model);
    console.log(`[Gemini] retry promptTokens=${rp} candidatesTokens=${rc}`);
    return parseAndValidate(retryText, transcript);
  }
}

export const geminiLabelService: LabelService = {
  extractDecisions,
  getEngineInfo: () => ({ name: 'gemini', version: lastModel }),
};
