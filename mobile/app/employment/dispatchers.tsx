import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { workApi, type AdminDispatcher } from '@/api/employment';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { FormError } from '@/components/states/FormError';
import { useSubmit } from '@/hooks/useSubmit';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function Dispatchers() {
  const { space } = useTheme();
  const [status, setStatus] = useState<'PENDING' | 'ACTIVE' | 'SUSPENDED'>('PENDING');
  const q = useQuery<AdminDispatcher[]>(`emp.dispatchers.${status}`, '/employment/dispatchers', { status });
  const review = async (id: string, to: 'ACTIVE' | 'REJECTED' | 'SUSPENDED', note?: string) => { await workApi.reviewDispatcher(id, to, note); q.refresh(); };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Dispatchers" subtitle="Students who deliver campus food orders." />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="To approve" selected={status === 'PENDING'} onPress={() => setStatus('PENDING')} />
        <Chip label="Active" selected={status === 'ACTIVE'} onPress={() => setStatus('ACTIVE')} />
        <Chip label="Suspended" selected={status === 'SUSPENDED'} onPress={() => setStatus('SUSPENDED')} />
      </View>
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="Nobody here" why={status === 'PENDING' ? 'No student is waiting for approval.' : 'No dispatchers with this status.'} /> : <>{list.map((d) => {
          const body = (
            <>
              <Text variant="label">{d.student.firstName} {d.student.lastName} <Text variant="small" tone="muted">{d.student.indexNumber}</Text></Text>
              <Text variant="small" tone="muted">{d.transport.toLowerCase()}. CGPA {d.cgpa?.toFixed(2) ?? 'none yet'}. {d.deliveriesLast30Days} deliveries in 30 days, {formatCedis(d.earnedLast30Days)} earned.</Text>
              {d.statement ? <Text variant="small">{d.statement}</Text> : null}
              {!d.eligibility.eligible ? <Badge label={d.eligibility.reasons.join(' ')} tone="warning" /> : null}
            </>
          );
          if (status === 'PENDING') return <DecisionCard key={d.id} rejectLabel="Reject" onApprove={() => review(d.id, 'ACTIVE')} onReject={(note) => review(d.id, 'REJECTED', note)}>{body}</DecisionCard>;
          return <Card key={d.id}>{body}{status === 'ACTIVE' ? <ReasonAction label="Suspend" danger onConfirm={(note) => review(d.id, 'SUSPENDED', note)} /> : <ReasonAction label="Reinstate" onConfirm={(note) => review(d.id, 'ACTIVE', note)} />}</Card>;
        })}</>}
      </QueryView>
    </Screen>
  );
}

/** A status change that needs a reason the student will read. */
function ReasonAction({ label, danger, onConfirm }: { label: string; danger?: boolean; onConfirm: (note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const { busy, error, run } = useSubmit();
  if (!open) return <Button label={label} variant={danger ? 'ghost' : 'secondary'} onPress={() => setOpen(true)} />;
  return (
    <>
      <FormError error={error} />
      <TextField label="Reason (the student sees it)" value={note} onChangeText={setNote} error={note && note.trim().length < 5 ? 'At least 5 characters.' : null} />
      <Button label={label} variant={danger ? 'danger' : 'primary'} disabled={note.trim().length < 5} loading={busy} onPress={() => void run(async () => { await onConfirm(note.trim()); setOpen(false); setNote(''); })} />
      <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
    </>
  );
}
