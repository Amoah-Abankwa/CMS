import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type Variant = 'title' | 'heading' | 'body' | 'small' | 'label';
type Tone = 'default' | 'muted' | 'primary' | 'danger' | 'success' | 'warning';

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps & { variant?: Variant; tone?: Tone }) {
  const { colors, type } = useTheme();
  const color = { default: colors.text, muted: colors.muted, primary: colors.primary, danger: colors.danger, success: colors.success, warning: colors.warning }[tone];
  return <RNText {...rest} style={[type[variant], { color }, style]} />;
}
