import { Pressable } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: !!selected }} onPress={onPress} style={{ borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }}>
      <Text variant="small" style={{ color: selected ? colors.primaryFg : colors.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}
