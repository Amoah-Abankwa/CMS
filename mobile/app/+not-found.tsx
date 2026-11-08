import { router } from 'expo-router';
import { EmptyState } from '@/components/states/EmptyState';
import { Screen } from '@/components/ui/Screen';

/** A link to a screen that does not exist (or no longer does). */
export default function NotFound() {
  return (
    <Screen>
      <EmptyState title="This screen does not exist" why="The link may be old, or the screen has moved in a newer version of the app." action={{ label: 'Go to Home', onPress: () => router.replace('/') }} />
    </Screen>
  );
}
