import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

/** A labelled field. A problem shows right under it, in words that say how to fix it. */
export const TextField = forwardRef<TextInput, TextInputProps & { label: string; error?: string | null; hint?: string }>(function TextField({ label, error, hint, style, ...rest }, ref) {
  const { colors, radius, space, type } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.muted}
        {...rest}
        style={[type.body, { color: colors.text, backgroundColor: colors.surface, borderWidth: error ? 2 : 1, borderColor: error ? colors.danger : colors.border, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 }, style]}
      />
      {error ? <Text variant="small" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="small" tone="muted">{hint}</Text> : null}
    </View>
  );
});
