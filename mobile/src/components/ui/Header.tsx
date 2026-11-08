import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

/** A page title with a way back (to Home if there is nowhere to go back to). */
export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
        <Text variant="label" tone="primary">Back</Text>
      </Pressable>
      <Text variant="title">{title}</Text>
      {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
    </View>
  );
}
