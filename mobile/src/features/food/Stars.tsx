import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/useTheme';

export function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={`${label}: ${value} of 5`} style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} hitSlop={6} accessibilityLabel={`${n} stars`} onPress={() => onChange(n)}><Ionicons name={n <= value ? 'star' : 'star-outline'} size={28} color={colors.warning} /></Pressable>)}
    </View>
  );
}
