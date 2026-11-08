import { View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors, radius, space } = useTheme();
  const map = { neutral: [colors.surfaceMuted, colors.muted], primary: [colors.primarySoft, colors.primary], success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger] }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: map[0], borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 2 }}>
      <Text variant="small" style={{ color: map[1], fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
