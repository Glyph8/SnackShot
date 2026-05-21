import * as SecureStore from 'expo-secure-store';

const SECURE_KEYS = {
  openai: 'snackshot.openai_api_key',
  gemini: 'snackshot.gemini_api_key',
} as const;

export async function getOpenAIKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(SECURE_KEYS.openai);
  if (stored) return stored;
  return process.env.EXPO_PUBLIC_DEV_OPENAI_API_KEY ?? null;
}

export async function setOpenAIKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEYS.openai, key);
}

// Gemini도 동일 패턴