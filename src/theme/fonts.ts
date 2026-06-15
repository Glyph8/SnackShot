import { Gaegu_400Regular, Gaegu_700Bold } from '@expo-google-fonts/gaegu';
import {
  NotoSansKR_400Regular, NotoSansKR_500Medium,
  NotoSansKR_600SemiBold, NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';

export const fontAssets: Record<string, number> = {
  Gaegu_400Regular, Gaegu_700Bold,
  NotoSansKR_400Regular, NotoSansKR_500Medium,
  NotoSansKR_600SemiBold, NotoSansKR_700Bold,
};

/** 로드할 폰트가 하나라도 있으면 true */
export const hasBundledFonts = Object.keys(fontAssets).length > 0;
