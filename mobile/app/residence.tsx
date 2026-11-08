import { useState } from 'react';
import { View } from 'react-native';
import { RESIDENCE_LABEL, type ResidenceRow } from '@/api/accommodation';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

type Kind = ResidenceRow['kind'];

export default function WhereStudentsLive() {
  const { space } = useTheme();
  const [kind, setKind] = useState<Kind | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery<{ semester: { label: string }; counts: Record<string, number>; total: number; page: number; pageSize: number; items: ResidenceRow[] }>(`residence.${kind}.${search}.${page}`, '/accommodation/residence', { kind: kind || undefined, search: search.trim() || undefined, page, pageSize: 30 });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Where students live" subtitle={q.data?.semester.label} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label="Everyone" selected={kind === ''} onPress={() => { setKind(''); setPage(1); }} />
        {(Object.keys(RESIDENCE_LABEL) as Kind[]).map((k) => <Chip key={k} label={`${RESIDENCE_LABEL[k]}${q.data?.counts[k] != null ? ` (${q.data.counts[k]})` : ''}`} selected={kind === k} onPress={() => { setKind(k); setPage(1); }} />)}
      </View>
      <TextField label="Find a student" value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Name or index number" />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="Nobody here" why={search ? `Nobody matches "${search}".` : 'No students in this group.'} /> : (
          <>
            {d.items.map((s) => (
              <Card key={s.id} style={{ padding: 10 }}>
                <Text variant="label">{s.firstName} {s.lastName} <Text variant="small" tone="muted">{s.indexNumber}</Text></Text>
                <Text variant="small" tone="muted">{RESIDENCE_LABEL[s.kind]}{s.where ? `: ${s.where}` : ''}{s.phone ? `. ${s.phone}` : ''}</Text>
              </Card>
            ))}
            {d.total > page * d.pageSize ? <Button label="More" variant="secondary" onPress={() => setPage(page + 1)} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
