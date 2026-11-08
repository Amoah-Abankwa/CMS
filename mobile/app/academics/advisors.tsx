import { useState } from 'react';
import { ScrollView } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
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
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

interface Data { advisors: Array<{ id: string; title: string | null; firstName: string; lastName: string; _count: { advisees: number } }>; students: Array<{ id: string; advisorId: string | null }> }

export default function Advisors() {
  const { space } = useTheme();
  const depts = useQuery<Array<{ id: string; name: string }>>('advisors.depts', '/advisors/departments');
  const [dept, setDept] = useState<string | null>(null);
  const departmentId = dept ?? depts.data?.[0]?.id ?? '';
  return (
    <Screen refreshing={depts.loading} onRefresh={depts.refresh}>
      <Header title="Academic advisors" subtitle="Each student gets their own advisor, who approves their course registration." />
      <QueryView q={depts} skeleton={<SkeletonList rows={2} />}>
        {(list) => list.length === 0 ? <EmptyState title="No departments" why="You can assign advisors in departments you lead." /> : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {list.map((d) => <Chip key={d.id} label={d.name} selected={departmentId === d.id} onPress={() => setDept(d.id)} />)}
            </ScrollView>
            {departmentId ? <Department departmentId={departmentId} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function Department({ departmentId }: { departmentId: string }) {
  const { space } = useTheme();
  const q = useQuery<Data>(`advisors.${departmentId}`, '/advisors', { departmentId });
  const [advisor, setAdvisor] = useState<string | null>(null);
  const [indexes, setIndexes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const list = indexes.split(/[\s,;]+/).filter(Boolean);
  const bad = list.filter((i) => !/^[A-Za-z]{2,6}\d{6,9}$/.test(i));
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
      {(d) => (
        <>
          <Text variant="small" tone="muted">{d.students.filter((s) => !s.advisorId).length} of {d.students.length} students have no advisor yet.</Text>
          <Card>
            <Text variant="label">Assign to</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {d.advisors.map((a) => <Chip key={a.id} label={`${a.title ?? ''} ${a.firstName} ${a.lastName} (${a._count.advisees})`.trim()} selected={advisor === a.id} onPress={() => setAdvisor(a.id)} />)}
              <Chip label="No advisor" selected={advisor === ''} onPress={() => setAdvisor('')} />
            </ScrollView>
            <TextField label="Index numbers" value={indexes} onChangeText={setIndexes} multiline placeholder="ANU25400001, ANU25400002" error={bad.length ? `Check these: ${bad.slice(0, 3).join(', ')}. Index numbers look like ANU25400001.` : null} />
            <FormError error={error} />
            {msg ? <Notice tone="success">{msg}</Notice> : null}
            <Button label={`Assign ${list.length || ''} students`.trim()} disabled={advisor === null || !list.length || bad.length > 0} loading={busy} onPress={() => void run(async () => {
              const r = (await axiosInstance.post<{ changed: number; notFound: string[] }>('/advisors/assign', { departmentId, advisorId: advisor || null, indexNumbers: list.map((i) => i.toUpperCase()) })).data;
              setMsg(`${r.changed} assigned.${r.notFound.length ? ` Not in this department: ${r.notFound.join(', ')}.` : ''}`); setIndexes(''); q.refresh();
            })} />
          </Card>
        </>
      )}
    </QueryView>
  );
}
