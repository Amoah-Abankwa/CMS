import { View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

/** Nothing to show: say why it is empty, then give one next step. */
export function EmptyState({ title, why, action }: { title: string; why: string; action?: { label: string; onPress: () => void } }) {
  const { space } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg, gap: space.sm }}>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      <Text tone="muted" style={{ textAlign: 'center' }}>{why}</Text>
      {action ? <View style={{ marginTop: space.md, alignSelf: 'stretch' }}><Button label={action.label} variant="secondary" onPress={action.onPress} /></View> : null}
    </View>
  );
}
