import { View } from 'react-native';
import { useTheme } from '@/theme/useTheme';

/** Real progress when the size is known (0 to 1); a short bar otherwise. */
export function ProgressBar({ value }: { value: number | null }) {
  const { colors, radius } = useTheme();
  const pct = value === null ? 0.15 : Math.max(0.03, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={value === null ? undefined : { min: 0, max: 100, now: Math.round(pct * 100) }} style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.primary }} />
    </View>
  );
}
