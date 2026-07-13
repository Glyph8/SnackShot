/**
 * API 키 관리 (ADR-023).
 * 우선순위: SecureStore(런타임 저장) > .env(개발 빌드 전용 fallback)
 *
 * ⚠️  EXPO_PUBLIC_* 환경변수는 빌드 시 번들에 인라인됨.
 *     fallback을 `__DEV__` 분기로 감싸 릴리스에서는 dead-code로 제거되도록 했다
 *     (minifier가 `false ? ... : undefined` 가지를 삭제 → 키 문자열도 함께 제거).
 *     그래도 가장 안전한 건 릴리스 빌드 시 .env에 실제 키를 두지 않는 것.
 */

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  openai: 'snackshot.openai_api_key',
  gemini: 'snackshot.gemini_api_key',
  quote: 'snackshot.quote_api_key',
  twelveData: 'snackshot.twelvedata_api_key',
} as const;

const MODEL_KEYS = {
  openai: 'snackshot.openai_model',
  gemini: 'snackshot.gemini_model',
} as const;

// ─── 선택 가능한 모델 목록 ─────────────────────────────────

export interface ModelOption {
  value: string;
  label: string;
}

// OpenAI 음성 인식(STT) 모델 — whisper-1은 segment/타임스탬프 지원, gpt-4o 계열은 텍스트 위주
export const OPENAI_STT_MODELS: ModelOption[] = [
  { value: 'whisper-1', label: 'Whisper' },
  { value: 'gpt-4o-transcribe', label: 'GPT-4o' },
  { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini' },
];

// Google Gemini 결정 추출 모델
export const GEMINI_MODELS: ModelOption[] = [
  { value: 'gemini-2.5-flash-lite', label: 'Flash Lite' },
  { value: 'gemini-2.5-flash', label: 'Flash' },
  { value: 'gemini-2.5-pro', label: 'Pro' },
];

export const DEFAULT_OPENAI_MODEL = OPENAI_STT_MODELS[0].value;
export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].value;

// ─── OpenAI ───────────────────────────────────────────────

export async function getOpenAIKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYS.openai);
  if (stored) return stored;
  // .env fallback은 개발 빌드에서만 — EXPO_PUBLIC_*는 릴리스 번들에 평문 노출되므로 차단
  return (__DEV__ ? process.env.EXPO_PUBLIC_DEV_OPENAI_API_KEY : undefined) ?? null;
}

export async function setOpenAIKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.openai, key);
}

export async function deleteOpenAIKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.openai);
}

export async function getOpenAIModel(): Promise<string> {
  return (await SecureStore.getItemAsync(MODEL_KEYS.openai)) ?? DEFAULT_OPENAI_MODEL;
}

export async function setOpenAIModel(model: string): Promise<void> {
  await SecureStore.setItemAsync(MODEL_KEYS.openai, model);
}

// ─── Gemini ───────────────────────────────────────────────

export async function getGeminiKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYS.gemini);
  if (stored) return stored;
  // .env fallback은 개발 빌드에서만 — EXPO_PUBLIC_*는 릴리스 번들에 평문 노출되므로 차단
  return (__DEV__ ? process.env.EXPO_PUBLIC_DEV_GEMINI_API_KEY : undefined) ?? null;
}

export async function setGeminiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.gemini, key);
}

export async function deleteGeminiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.gemini);
}

// ─── 시세 API (H4 — 공공데이터포털 서비스키) ───────────────────────────────
export async function getQuoteApiKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYS.quote);
  if (stored) return stored;
  return (__DEV__ ? process.env.EXPO_PUBLIC_DEV_QUOTE_API_KEY : undefined) ?? null;
}

export async function setQuoteApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.quote, key);
}

export async function deleteQuoteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.quote);
}

// ─── 미국 시세 (H6 — Twelve Data) ─────────────────────────────
export async function getTwelveDataKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYS.twelveData);
  if (stored) return stored;
  return (__DEV__ ? process.env.EXPO_PUBLIC_DEV_TWELVEDATA_API_KEY : undefined) ?? null;
}

export async function setTwelveDataKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.twelveData, key);
}

export async function deleteTwelveDataKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.twelveData);
}

export async function getGeminiModel(): Promise<string> {
  return (await SecureStore.getItemAsync(MODEL_KEYS.gemini)) ?? DEFAULT_GEMINI_MODEL;
}

export async function setGeminiModel(model: string): Promise<void> {
  await SecureStore.setItemAsync(MODEL_KEYS.gemini, model);
}
