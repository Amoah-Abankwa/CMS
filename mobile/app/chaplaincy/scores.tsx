import { useState } from 'react';
import { devotionApi, type ScoresView } from '@/api/devotion';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';

export default function Scores() {
  const [search, setSearch] = useState('');
  const q = useQuery<ScoresView>(`chapel.scores.${search}`, '/devotion/scores', { page: 1, pageSize: 50, search: search.trim() || undefined });
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Devotion scores" subtitle={q.data ? `${q.data.semester.label}. Average ${q.data.stats.average?.toFixed(1) ?? '-'} of ${q.data.policy.totalMarks}.` : undefined} />
      <TextField label="Find a student" value={search} onChangeText={setSearch} placeholder="Name or index number" />
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => (
          <>
            {d.finalizedAt ? <Notice tone="info" title="Scores are final">Finalised {new Date(d.finalizedAt).toLocaleDateString()} and added to students' results.</Notice> : (
              <Button label="Finalise scores for the semester" variant="secondary" loading={busy} onPress={() => void run(async () => { const r = await devotionApi.finalise(); setMsg(`${r.students} students scored; ${r.notified} told.`); q.refresh(); })} />
            )}
            {d.items.length === 0 ? <EmptyState title="No students found" why={search ? `Nobody matches "${search}".` : 'Scores appear once services are closed.'} /> : d.items.map((s) => (
              <Card key={s.id} style={{ padding: 10 }}>
                <Text variant="label">{s.firstName} {s.lastName} <Text variant="small" tone="muted">{s.indexNumber}</Text></Text>
                <Text variant="small">{s.finalScore ?? s.score ?? '-'} of {d.policy.totalMarks}. {s.early} on time, {s.late} late, {s.absent} absent, {s.excused} excused.</Text>
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
