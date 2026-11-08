import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

export function QuantityStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { colors, space } = useTheme();
  const btn = (name: 'remove-circle-outline' | 'add-circle', d: number, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${a11y} ${label}`} hitSlop={8} onPress={() => onChange(Math.max(0, Math.min(20, value + d)))}>
      <Ionicons name={name} size={28} color={colors.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {value > 0 ? btn('remove-circle-outline', -1, 'One less') : null}
      {value > 0 ? <Text variant="label" accessibilityLabel={`${value} in basket`}>{value}</Text> : null}
      {btn('add-circle', 1, 'Add')}
    </View>
  );
}
