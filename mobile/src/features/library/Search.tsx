import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { libraryApi, type TitleRow } from '@/api/library';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { NoResults } from '@/components/states/NoResults';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { didYouMean, vocabulary } from '@/lib/search';
import { useCache } from '@/stores/cache';
import { useTheme } from '@/theme/useTheme';

/** Searching the catalogue; nothing found offers the corrected spelling from titles seen before. */
export function Search() {
  const { space } = useTheme();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<TitleRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const put = useCache((s) => s.put);
  const seen = useCache((s) => s.entries['library.seen']?.data as string[] | undefined);
  const words = useMemo(() => vocabulary(seen ?? []), [seen]);
  useEffect(() => {
    const t = query.trim();
    if (t.length < 2) { setRows(null); return; }
    const timer = setTimeout(() => void run(async () => {
      const r = await libraryApi.search({ search: t, page: 1, pageSize: 30 });
      setRows(r.items);
      if (r.items.length) put('library.seen', [...new Set([...(seen ?? []), ...r.items.map((i) => `${i.title} ${i.authors.join(' ')}`)])].slice(-500));
    }), 350);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ gap: space.md }}>
      <TextField label="Search the catalogue" value={query} onChangeText={setQuery} placeholder="Title, author, subject or ISBN" autoCorrect={false} />
      <FormError error={error} />
      {note ? <Text tone="success">{note}</Text> : null}
      {rows === null ? (busy ? <SkeletonList rows={4} /> : <EmptyState title="Find a book" why="Type at least two letters of a title, author or subject." />) : rows.length === 0 ? (
        <NoResults query={query} suggestion={didYouMean(query, words)} onSearch={setQuery} next={{ label: 'Search by subject instead, e.g. "programming"', query: 'programming' }} />
      ) : rows.map((t) => (
        <Card key={t.id}>
          <Text variant="label">{t.title}{t.edition ? `, ${t.edition}` : ''}</Text>
          <Text variant="small" tone="muted">{t.authors.join(', ')}{t.callNumber ? `. Shelf ${t.callNumber}` : ''}</Text>
          {t.available > 0 ? <Badge label={`${t.available} on the shelf`} tone="success" /> : t.lendable > 0 ? <Badge label={`All out${t.waiting ? `, ${t.waiting} waiting` : ''}`} tone="warning" /> : <Badge label="Reference only" />}
          {t.lendable > 0 && t.available === 0 ? <Button label="Reserve" variant="secondary" loading={busy} onPress={() => void run(async () => { const r = await libraryApi.reserve(t.id); setNote(`Reserved "${t.title}". You are number ${r.position} in the queue; we will tell you when it is ready.`); })} /> : null}
        </Card>
      ))}
    </View>
  );
}
