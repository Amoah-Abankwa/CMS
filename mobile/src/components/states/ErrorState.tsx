import { View } from 'react-native';
import { router } from 'expo-router';
import type { Described } from '@/lib/errors';
import { useTheme } from '@/theme/useTheme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

/** Something failed: what went wrong, whose fault it is, and how to fix it. */
export function ErrorState({ error, onRetry }: { error: Described; onRetry?: () => void }) {
  const { space } = useTheme();
  return (
    <Card accessibilityRole="alert">
      <Text variant="heading">{error.what}</Text>
      <Text tone="muted">{error.whose}</Text>
      <Text>{error.fix}</Text>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        {error.retry && onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
        {error.kind === 'permission' || error.kind === 'missing' ? <Button label="Back to Home" variant="secondary" onPress={() => router.replace('/')} /> : null}
      </View>
    </Card>
  );
}
