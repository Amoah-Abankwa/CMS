import { useState } from 'react';
import { developerApi, type DeveloperCandidate } from '@/api/developer';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { StepUpPrompt } from '@/components/states/StepUpPrompt';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useStepUp } from '@/hooks/useStepUp';
import { useSubmit } from '@/hooks/useSubmit';

export default function DeveloperAccess() {
  const [search, setSearch] = useState('');
  const q = useQuery<DeveloperCandidate[]>(`dev.${search}`, '/admin/developer-access', { search: search.trim() || undefined });
  const step = useStepUp();
  const [msg, setMsg] = useState<string | null>(null);
  const { error } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Developer access" subtitle="Time-limited access to diagnostics for the people who maintain the platform. Every grant is recorded." />
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {step.asking ? <StepUpPrompt onConfirm={step.confirm} onCancel={step.cancel} /> : null}
      <TextField label="Find a staff member" value={search} onChangeText={setSearch} placeholder="Name or email" />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="Nobody found" why="Search for the staff member by name or email." /> : <>{list.map((c) => <Candidate key={c.id} c={c} guard={step.guard} onDone={(t) => { setMsg(t); q.refresh(); }} />)}</>}
      </QueryView>
    </Screen>
  );
}

function Candidate({ c, guard, onDone }: { c: DeveloperCandidate; guard: (fn: () => Promise<void>) => Promise<void>; onDone: (t: string) => void }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSubmit();
  const reasonError = reason && reason.trim().length < 10 ? 'Say what it is for (at least 10 characters).' : null;
  const daysError = !(Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 30) ? 'From 1 to 30 days.' : null;
  return (
    <Card>
      <Text variant="label">{c.firstName} {c.lastName} <Text variant="small" tone="muted">{c.email}</Text></Text>
      {c.activeGrant ? <Badge label={`Has access${c.activeGrant.expiresAt ? ` until ${new Date(c.activeGrant.expiresAt).toLocaleDateString()}` : ''}`} tone="warning" /> : null}
      <FormError error={error} />
      {open ? (
        <>
          <TextField label="Reason (recorded)" value={reason} onChangeText={setReason} error={reasonError} />
          {!c.activeGrant ? <TextField label="For how many days" value={days} keyboardType="number-pad" onChangeText={setDays} error={daysError} /> : null}
          <Button label={c.activeGrant ? 'Take access away' : 'Give access'} variant={c.activeGrant ? 'danger' : 'primary'} disabled={reason.trim().length < 10 || (!c.activeGrant && !!daysError)} loading={busy} onPress={() => void run(() => guard(async () => {
            if (c.activeGrant) { await developerApi.disable(c.id, reason.trim()); onDone(`Access taken away from ${c.firstName}.`); }
            else { await developerApi.enable(c.id, reason.trim(), new Date(Date.now() + Number(days) * 86400000).toISOString()); onDone(`${c.firstName} has developer access for ${days} days.`); }
            setOpen(false); setReason('');
          }))} />
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </>
      ) : <Button label={c.activeGrant ? 'Take access away' : 'Give access'} variant="ghost" onPress={() => setOpen(true)} />}
    </Card>
  );
}
