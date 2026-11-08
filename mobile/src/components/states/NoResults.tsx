import { View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

/** A search found nothing: fix the typo for them, and suggest a next search. */
export function NoResults({ query, suggestion, onSearch, next }: { query: string; suggestion: string | null; onSearch: (q: string) => void; next: { label: string; query: string } }) {
  const { space } = useTheme();
  return (
    <View style={{ paddingVertical: space.xl, gap: space.sm }}>
      <Text variant="heading">Nothing matches “{query}”</Text>
      {suggestion ? (
        <>
          <Text tone="muted">It may be a typo.</Text>
          <Button label={`Search for “${suggestion}” instead`} onPress={() => onSearch(suggestion)} />
        </>
      ) : (
        <Text tone="muted">Searches look at course codes and titles. Try a shorter word.</Text>
      )}
      <Button label={next.label} variant="ghost" onPress={() => onSearch(next.query)} />
    </View>
  );
}
