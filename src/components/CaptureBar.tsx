import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, iconSize, radius, shadow, spacing } from '@/theme';

interface Props {
  onUpload: () => void;
  onAudio: () => void;
  onVideo: () => void;
}

interface BtnProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
}

function CaptureButton({ label, icon, onPress, primary = false }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={iconSize.lg}
        color={primary ? colors.brand.onPrimary : colors.text.secondary}
      />
      <AppText preset="caption" color={primary ? colors.brand.onPrimary : colors.text.secondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** 캡처 툴바 — 업로드 · 음성 · 영상. 영상이 주요 액션(primary). */
export function CaptureBar({ onUpload, onAudio, onVideo }: Props) {
  return (
    <View style={styles.row}>
      <CaptureButton label="업로드" icon="cloud-upload-outline" onPress={onUpload} />
      <CaptureButton label="음성" icon="mic" onPress={onAudio} />
      <CaptureButton label="영상" icon="videocam" onPress={onVideo} primary />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadow.card,
  },
  secondary: { backgroundColor: colors.surface.paperRaised, borderWidth: 1, borderColor: colors.border.card },
  primary: { backgroundColor: colors.brand.primary },
  pressed: { opacity: 0.85 },
});
