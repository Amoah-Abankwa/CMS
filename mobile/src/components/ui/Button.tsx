import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ label, variant = 'primary', loading, disabled, ...rest }: Omit<PressableProps, 'children'> & { label: string; variant?: Variant; loading?: boolean }) {
  const { colors, radius, space } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.surface, ghost: 'transparent', danger: colors.danger }[variant];
  const fg = { primary: colors.primaryFg, secondary: colors.text, ghost: colors.primary, danger: colors.primaryFg }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderRadius: radius.md, paddingHorizontal: space.lg, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text variant="label" style={{ color: fg }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({ base: { minHeight: 48, alignItems: 'center', justifyContent: 'center' } });
