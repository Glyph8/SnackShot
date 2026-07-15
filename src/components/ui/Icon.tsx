import { Ionicons } from '@expo/vector-icons';

import { colors, iconSize } from '@/theme';

// 아이콘 단일 진입점(톤 정합). 앱 전체는 의미 이름(IconName)만 쓰고,
// 글리프 매핑·기본 크기·색은 여기서만 관리한다.
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 아이콘 세트 교체는 "이 파일 한 곳"에서 끝난다 (호출처 0곳 수정).        ║
// ║                                                                        ║
// ║ A) @expo/vector-icons 내 다른 패밀리로 교체(설치 불필요, 가장 간편):   ║
// ║    1) 위 import를 바꾼다.  예: import { Feather } from '@expo/...';     ║
// ║    2) 아래 ICON_PROVIDER 를 그 패밀리로 바꾼다.  예: = Feather;          ║
// ║    3) REGISTRY 의 글리프 이름을 새 패밀리 기준으로 수정한다.            ║
// ║       (아웃라인/채움 구분이 없는 패밀리는 [g, g] 처럼 같은 값을 둔다.)   ║
// ║                                                                        ║
// ║ B) 외부 SVG 세트(예: lucide-react-native)로 교체:                      ║
// ║    react-native-svg 설치(데브클라이언트 리빌드) 후, 맨 아래            ║
// ║    Icon 컴포넌트의 렌더 한 줄만 그 세트의 컴포넌트로 바꾼다.           ║
// ╚══════════════════════════════════════════════════════════════════════╝
const ICON_PROVIDER = Ionicons;
type Glyph = keyof typeof ICON_PROVIDER.glyphMap;

export type IconName =
  | 'today' | 'archive' | 'inbox' | 'settings' | 'decisions' | 'invest'
  | 'video' | 'audio' | 'text' | 'doc' | 'camera' | 'photo'
  | 'close' | 'close-circle' | 'flip' | 'search'
  | 'back' | 'forward' | 'arrow-back' | 'arrow-up' | 'arrow-down' | 'undo'
  | 'chevron-up' | 'chevron-down'
  | 'play' | 'pause' | 'mic'
  | 'check' | 'check-circle' | 'done' | 'radio-off' | 'checkbox' | 'board'
  | 'add' | 'more' | 'idea' | 'deck' | 'help' | 'calendar' | 'list'
  | 'open' | 'box' | 'upload' | 'trash';

// 의미 이름 → [아웃라인, 채움] 글리프. 둘이 같으면 변형 없는 글리프.
// 세트를 바꾸면 이 표의 글리프 이름만 갈아끼우면 된다(왼쪽 의미 이름은 그대로).
const REGISTRY: Record<IconName, [Glyph, Glyph]> = {
  today: ['today-outline', 'today'],
  archive: ['film-outline', 'film'],
  inbox: ['mail-outline', 'mail'],
  settings: ['settings-outline', 'settings'],
  decisions: ['checkbox-outline', 'checkbox'],
  invest: ['stats-chart-outline', 'stats-chart'],
  video: ['videocam-outline', 'videocam'],
  camera: ['camera-outline', 'camera'],
  photo: ['image-outline', 'image'],
  audio: ['mic-outline', 'mic'],
  text: ['create-outline', 'create'],
  doc: ['document-text-outline', 'document-text'],
  close: ['close', 'close'],
  'close-circle': ['close-circle', 'close-circle'],
  flip: ['camera-reverse-outline', 'camera-reverse'],
  search: ['search-outline', 'search'],
  back: ['chevron-back', 'chevron-back'],
  forward: ['chevron-forward', 'chevron-forward'],
  'arrow-back': ['arrow-back', 'arrow-back'],
  'arrow-up': ['arrow-up', 'arrow-up'],
  'arrow-down': ['arrow-down', 'arrow-down'],
  undo: ['arrow-undo-outline', 'arrow-undo'],
  'chevron-up': ['chevron-up', 'chevron-up'],
  'chevron-down': ['chevron-down', 'chevron-down'],
  play: ['play', 'play'],
  pause: ['pause', 'pause'],
  mic: ['mic-outline', 'mic'],
  check: ['checkmark', 'checkmark'],
  'check-circle': ['checkmark-circle-outline', 'checkmark-circle'],
  done: ['checkmark-done-circle-outline', 'checkmark-done-circle'],
  'radio-off': ['ellipse-outline', 'ellipse'],
  checkbox: ['square-outline', 'checkbox'],
  board: ['checkbox-outline', 'checkbox'],
  add: ['add', 'add'],
  more: ['ellipsis-horizontal', 'ellipsis-horizontal'],
  idea: ['bulb-outline', 'bulb'],
  deck: ['albums-outline', 'albums'],
  list: ['list-outline', 'list'],
  help: ['help-circle-outline', 'help-circle'],
  calendar: ['calendar-outline', 'calendar'],
  open: ['open-outline', 'open'],
  box: ['archive-outline', 'archive'],
  upload: ['cloud-upload-outline', 'cloud-upload'],
  trash: ['trash-outline', 'trash'],
};

interface Props {
  name: IconName;
  /** 기본 iconSize.md */
  size?: number;
  /** 기본 text.secondary */
  color?: string;
  /** true면 채움 글리프 사용 */
  active?: boolean;
}

export function Icon({ name, size = iconSize.md, color = colors.text.secondary, active = false }: Props) {
  const [outline, filled] = REGISTRY[name];
  // 세트 교체(B안) 시 이 한 줄만 새 세트 컴포넌트로 바꾸면 된다.
  return <ICON_PROVIDER name={active ? filled : outline} size={size} color={color} />;
}
