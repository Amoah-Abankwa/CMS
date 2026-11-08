import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/useTheme';

export function Card({ style, ...rest }: ViewProps) {
  const { colors, radius, space } = useTheme();
  return <View {...rest} style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg, gap: space.sm }, style]} />;
}
