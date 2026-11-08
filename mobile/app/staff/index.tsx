import { useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import type { StaffMember } from '@/api/staff';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';

export default function Staff() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery<{ items: StaffMember[]; total: number; page: number; pageSize: number }>(`staff.${search}.${page}`, '/staff', { page, pageSize: 25, search: search.trim() || undefined });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Staff" subtitle={q.data ? `${q.data.total} staff` : undefined} />
      <Button label="Add staff member" onPress={() => router.push('/staff/new' as never)} />
      <TextField label="Find someone" value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Name, email or staff number" autoCorrect={false} />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => d.items.length === 0 ? <EmptyState title={search ? `Nobody matches "${search}"` : 'No staff yet'} why={search ? 'Check the spelling, or search by email.' : 'Add staff one by one, or import them.'} /> : (
          <>
            {d.items.map((s) => (
              <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/staff/${s.id}` as never)}>
                <Card style={{ padding: 12 }}>
                  <Text variant="label">{[s.staffProfile?.title, s.firstName, s.lastName].filter(Boolean).join(' ')}</Text>
                  <Text variant="small" tone="muted">{s.staffProfile?.department?.name ?? 'No department'}. {s.roles.map((r) => r.name).join(', ')}</Text>
                  {s.status !== 'ACTIVE' ? <Badge label={s.status === 'PENDING_SETUP' ? 'Not set up yet' : s.status.toLowerCase()} tone="warning" /> : null}
                </Card>
              </Pressable>
            ))}
            {d.total > page * d.pageSize ? <Button label="More" variant="secondary" onPress={() => setPage(page + 1)} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
