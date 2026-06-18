import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * 현재 키보드 높이(px). 닫히면 0으로 깔끔히 리셋된다.
 *
 * KeyboardAvoidingView(behavior="padding")가 Android edge-to-edge에서 키보드를 닫은 뒤
 * 하단 여백을 남기는 버그를 피하기 위한 대안 — 스크롤뷰 contentContainer의 paddingBottom에
 * 이 값을 더하면, 키보드가 떠 있을 때만 여백이 생기고 닫히면 사라진다.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
