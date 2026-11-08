import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Text } from '../ui/Text';

type Tone = 'info' | 'success' | 'warning' | 'danger';

/** A short message box. Flat colour, no gradient. */
export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  const { colors, radius, space } = useTheme();
  const [bg, fg] = { info: [colors.primarySoft, colors.primary], success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger] }[tone];
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : 'summary'} style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, gap: space.xs, borderLeftWidth: 4, borderLeftColor: fg }}>
      {title ? <Text variant="label" style={{ color: fg }}>{title}</Text> : null}
      {typeof children === 'string' ? <Text variant="small">{children}</Text> : children}
    </View>
  );
}
