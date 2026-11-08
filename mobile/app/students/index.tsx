import { useState } from 'react';
import { studentsApi, type StudentRow } from '@/api/students';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { StatusChange } from '@/components/ui/StatusChange';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';

const STATUS: Record<string, [string, 'success' | 'warning' | 'danger' | 'neutral']> = { ACTIVE: ['Active', 'success'], PENDING_SETUP: ['Not set up yet', 'warning'], SUSPENDED: ['Suspended', 'danger'], DEACTIVATED: ['Deactivated', 'neutral'] };

export default function Students() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery<{ items: StudentRow[]; total: number; page: number; pageSize: number }>(`students.${search}.${page}`, '/students', { page, pageSize: 25, search: search.trim() || undefined });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Students" subtitle={q.data ? `${q.data.total} students` : undefined} />
      <TextField label="Find a student" value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Name, index number or email" autoCorrect={false} />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => d.items.length === 0 ? <EmptyState title={search ? `Nobody matches "${search}"` : 'No students yet'} why={search ? 'Check the spelling, or search by index number.' : 'Register students one by one, or import them from the previous system.'} /> : (
          <>
            {d.items.map((s) => <StudentCard key={s.id} s={s} onChange={q.refresh} />)}
            {d.total > page * d.pageSize ? <Button label="More" variant="secondary" onPress={() => setPage(page + 1)} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function StudentCard({ s, onChange }: { s: StudentRow; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <Card>
      <Text variant="label">{s.firstName} {s.lastName} <Text variant="small" tone="muted">{s.indexNumber}</Text></Text>
      <Text variant="small" tone="muted">{s.studentProfile ? `${s.studentProfile.programme.name}, level ${s.studentProfile.currentLevel}, admitted ${s.studentProfile.admissionYear}` : ''}</Text>
      <Badge label={STATUS[s.status]?.[0] ?? s.status} tone={STATUS[s.status]?.[1] ?? 'neutral'} />
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {open ? (
        <>
          {s.status === 'PENDING_SETUP' ? <Button label="Send the set-up link again" variant="secondary" loading={busy} onPress={() => void run(async () => { await studentsApi.resendSetup(s.id); setMsg('Set-up link sent by email and SMS.'); })} /> : null}
          <StatusChange status={s.status} onChange={async (to, reason) => { await studentsApi.setStatus(s.id, to, reason); onChange(); }} />
        </>
      ) : <Button label="Manage" variant="ghost" onPress={() => setOpen(true)} />}
    </Card>
  );
}
