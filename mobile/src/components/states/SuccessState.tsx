import { View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

/** It worked: confirm, reassure, then show what happens next. */
export function SuccessState({ title, reassurance, next, action }: { title: string; reassurance: string; next: string; action?: { label: string; onPress: () => void } }) {
  const { colors, space } = useTheme();
  return (
    <Card accessibilityRole="summary" style={{ borderColor: colors.success }}>
      <Text variant="heading" tone="success">{title}</Text>
      <Text>{reassurance}</Text>
      <Text tone="muted">Next: {next}</Text>
      {action ? <View style={{ marginTop: space.sm }}><Button label={action.label} onPress={action.onPress} /></View> : null}
    </Card>
  );
}
