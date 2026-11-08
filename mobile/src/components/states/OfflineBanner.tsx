import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '@/stores/network';
import { useTheme } from '@/theme/useTheme';
import { Text } from '../ui/Text';

/** Shown over every screen while offline. Saved screens stay; this says what still works. */
export function OfflineBanner() {
  const online = useNetwork((s) => s.online);
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: colors.warningSoft, paddingTop: insets.top + space.xs, paddingBottom: space.sm, paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text variant="label" tone="warning">You are offline</Text>
      <Text variant="small">Screens you have opened show their last saved copy, and anything you are writing is kept. Refreshing and sending wait until you are back online.</Text>
    </View>
  );
}
