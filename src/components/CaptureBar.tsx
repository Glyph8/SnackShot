import { StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName, PressableScale, Tape } from '@/components/ui';
import { colors, iconSize, radius, shadow, spacing } from '@/theme';

interface Props {
  onUpload: () => void;
  onAudio: () => void;
  onCapture: () => void;
}

interface BtnProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** 기울임 각도(도) — 붙인 사진처럼 살짝 비뚤게 */
  tilt: number;
  primary?: boolean;
}

/** 붙인 사진 카드 버튼 — 종이 프레임 + 위에 붙인 테이프 + 미디어 썸네일 느낌. */
function CaptureButton({ label, icon, onPress, tilt, primary = false }: BtnProps) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      containerStyle={styles.fill}
      style={[styles.card, { transform: [{ rotate: `${tilt}deg` }] }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.tape} pointerEvents="none">
        <Tape width={40} height={14} angle={0} vary={`capture-${label}`} />
      </View>
      <View style={[styles.thumb, primary ? styles.thumbPrimary : styles.thumbMedia]}>
        <Icon
          name={icon}
          active={primary}
          size={iconSize.lg}
          color={primary ? colors.brand.onPrimary : colors.text.onMedia}
        />
      </View>
      <AppText preset="caption" color={primary ? colors.brand.primary : colors.text.secondary} style={styles.label}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/** 캡처 툴바 — 업로드 · 음성 · 촬영. 촬영(사진/영상)이 주요 액션(primary). */
export function CaptureBar({ onUpload, onAudio, onCapture }: Props) {
  return (
    <View style={styles.row}>
      <CaptureButton label="업로드" icon="upload" onPress={onUpload} tilt={-4} />
      <CaptureButton label="음성" icon="audio" onPress={onAudio} tilt={3} />
      <CaptureButton label="촬영" icon="camera" onPress={onCapture} tilt={-2.5} primary />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
  fill: { flex: 1 },
  card: {
    backgroundColor: colors.surface.paperRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadow.raised,
  },
  tape: { position: 'absolute', top: -spacing.sm, alignSelf: 'center', zIndex: 2 },
  thumb: {
    alignSelf: 'stretch',
    aspectRatio: 1.4,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMedia: { backgroundColor: colors.media.thumbSlate },
  thumbPrimary: { backgroundColor: colors.brand.primary },
  label: { marginBottom: spacing.xs },
});
