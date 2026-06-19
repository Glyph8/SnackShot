import { Ionicons } from '@expo/vector-icons';

import { colors, iconSize } from '@/theme';

// 아이콘 단일 진입점(톤 정합). 의미 이름 → 글리프 매핑을 여기 한 곳에 모아,
// 추후 톤/세트 교체(예: 손그림 SVG)를 이 파일만 고쳐 끝낼 수 있게 한다.
// 규칙: 기본은 아웃라인(가벼운 종이 톤), 활성/주요 상태만 채움(active).
type Glyph = keyof typeof Ionicons.glyphMap;

export type IconName =
  | 'today' | 'archive' | 'inbox' | 'settings'
  | 'video' | 'audio' | 'text' | 'doc'
  | 'close' | 'close-circle' | 'flip' | 'search'
  | 'back' | 'forward' | 'arrow-back' | 'arrow-up' | 'arrow-down' | 'undo'
  | 'chevron-up' | 'chevron-down'
  | 'play' | 'pause' | 'mic'
  | 'check' | 'check-circle' | 'done' | 'radio-off' | 'checkbox' | 'board'
  | 'add' | 'more' | 'idea' | 'deck' | 'help' | 'calendar'
  | 'open' | 'box' | 'upload' | 'trash';

// [아웃라인, 채움] — 둘이 같으면 변형 없는 글리프.
const REGISTRY: Record<IconName, [Glyph, Glyph]> = {
  today: ['today-outline', 'today'],
  archive: ['film-outline', 'film'],
  inbox: ['mail-outline', 'mail'],
  settings: ['settings-outline', 'settings'],
  video: ['videocam-outline', 'videocam'],
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
  return <Ionicons name={active ? filled : outline} size={size} color={color} />;
}
