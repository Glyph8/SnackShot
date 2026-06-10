/**
 * API 키 관리 (ADR-023).
 * 우선순위: SecureStore(런타임 저장) > .env(개발용 fallback)
 *
 * ⚠️  EXPO_PUBLIC_* 환경변수는 번들에 포함되어 APK 분해 시 노출됨.
 *     production 빌드 전 .env에서 키 제거 필수.
 */

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  openai: 'snackshot.openai_api_key',
  gemini: 'snackshot.gemini_api_key',
} as const;

// ─── OpenAI ───────────────────────────────────────────────

export async function getOpenAIKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYS.openai);
  if (stored) return stored;
  return process.env.EXPO_PUBLIC_DEV_OPENAI_API_KEY ?? null;
}

export async function setOpenAIKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.openai, key);
}

export async function deleteOpenAIKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.openai);
}

// ─── Gemini ───────────────────────────────────────────────

export async function getGeminiKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYS.gemini);
  if (stored) return stored;
  return process.env.EXPO_PUBLIC_DEV_GEMINI_API_KEY ?? null;
}

export async function setGeminiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.gemini, key);
}

export async function deleteGeminiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.gemini);
}
