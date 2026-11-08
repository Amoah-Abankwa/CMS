import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { feesApi, type LevyMembers, type Office } from '@/api/fees';
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
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/** Association officers: who has paid each levy, and recording cash with a receipt. */
export default function AssociationDues() {
  const q = useQuery<Office[]>('assoc.offices', '/association');
  const [levy, setLevy] = useState<string | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Association dues" />
      {levy ? <Members levyId={levy} onBack={() => { setLevy(null); q.refresh(); }} /> : (
        <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
          {(list) => list.length === 0 ? <EmptyState title="You are not an officer" why="The Dean of Students office records association officers after each election." /> : <>{list.map((o) => (
            <Card key={o.association.id}>
              <Text variant="heading">{o.association.code}: {o.association.name}</Text>
              <Text variant="small" tone="muted">You are {o.office.toLowerCase()} until {new Date(o.endsOn).toLocaleDateString()}. {o.members} students.{o.patron ? ` Dues are set by ${o.patron.firstName} ${o.patron.lastName}.` : ''}</Text>
              {o.levies.length === 0 ? <Text variant="small">No dues set this semester yet.</Text> : o.levies.map((l) => (
                <View key={l.id} style={{ gap: 4 }}>
                  <Text variant="label">{l.title}: {formatCedis(l.amount)}</Text>
                  <Text variant="small" tone="muted">{l.paidCount} paid ({formatCedis(l.online)} online, {formatCedis(l.cash)} cash){l.isOpen ? '' : '. Closed.'}</Text>
                  <Button label="Members and cash" variant="secondary" onPress={() => setLevy(l.id)} />
                </View>
              ))}
            </Card>
          ))}</>}
        </QueryView>
      )}
    </Screen>
  );
}

function Members({ levyId, onBack }: { levyId: string; onBack: () => void }) {
  const { space } = useTheme();
  const q = useQuery<LevyMembers>(`assoc.levy.${levyId}`, `/association/levies/${levyId}`);
  const [index, setIndex] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const bad = index && !/^[A-Za-z]{2,6}\d{6,9}$/.test(index.trim()) ? 'An index number looks like ANU25400001.' : null;
  return (
    <View style={{ gap: space.md }}>
      <Button label="Back" variant="ghost" onPress={onBack} />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => (
          <>
            <Card>
              <Text variant="heading">{d.levy.title}, {formatCedis(d.levy.amount)}</Text>
              <FormError error={error} />
              {msg ? <Notice tone="success">{msg}</Notice> : null}
              {d.levy.isOpen ? (
                <>
                  <TextField label="Record cash from" value={index} autoCapitalize="characters" onChangeText={setIndex} placeholder="Index number" error={bad} />
                  <Button label={`Received ${formatCedis(d.levy.amount)} cash`} disabled={!index || !!bad} loading={busy} onPress={() => void run(async () => { const r = await feesApi.recordCash(levyId, index.trim().toUpperCase()); setMsg(`Receipt ${r.receiptNumber} for ${r.student}. Give them the number.`); setIndex(''); q.refresh(); })} />
                </>
              ) : <Text tone="muted">Collection is closed.</Text>}
            </Card>
            {d.members.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={{ flex: 1 }}>{m.firstName} {m.lastName} <Text variant="small" tone="muted">{m.indexNumber}</Text></Text>
                {m.payment ? <Badge label={`${m.payment.method === 'CASH' ? 'Cash' : 'Online'} ${m.payment.receiptNumber}`} tone="success" /> : <Badge label="Not paid" />}
              </View>
            ))}
          </>
        )}
      </QueryView>
    </View>
  );
}
