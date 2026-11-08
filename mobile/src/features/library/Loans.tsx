import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { libraryApi, type BorrowerSummary } from '@/api/library';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { PaymentStarted } from '@/components/states/PaymentStarted';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { openPayment } from '@/lib/pay';
import { useTheme } from '@/theme/useTheme';

const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Books out, reservations and fines: renew, cancel, pay online. */
export function Loans() {
  const { space } = useTheme();
  const q = useQuery<BorrowerSummary>('me.library', '/me/library');
  const { busy, error, run } = useSubmit();
  const [paying, setPaying] = useState(false);
  if (paying) return <PaymentStarted what="your library fine" onRefresh={() => { setPaying(false); q.refresh(); }} />;
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
      {(d) => (
        <View style={{ gap: space.md }}>
          <FormError error={error} />
          {d.blocks.length ? <Notice tone="warning" title="Borrowing is paused">{d.blocks.join(' ')}</Notice> : null}
          <Text variant="heading">Books you have</Text>
          {d.loans.length === 0 ? <EmptyState title="No books out" why="Borrow at the library desk with your ID card; your loans show here with their due dates." /> : d.loans.map((l) => (
            <Card key={l.id}>
              <Text variant="label">{l.copy.title.title}</Text>
              <Text variant="small" tone="muted">{l.copy.title.authors.join(', ')}</Text>
              <Text tone={l.overdueDays ? 'danger' : 'default'}>{l.overdueDays ? `${l.overdueDays} days overdue, fine so far ${formatCedis(l.fineSoFar)}` : `Due ${day(l.dueAt)}`}</Text>
              {l.canRenew ? <Button label="Renew" variant="secondary" loading={busy} onPress={() => void run(async () => { await libraryApi.renew(l.id); q.refresh(); })} /> : l.renewBlock ? <Text variant="small" tone="muted">{l.renewBlock}</Text> : null}
            </Card>
          ))}
          {d.reservations.length ? <Text variant="heading">Reservations</Text> : null}
          {d.reservations.map((r) => (
            <Card key={r.id}>
              <Text variant="label">{r.title.title}</Text>
              {r.status === 'READY' ? <Badge label={`Ready to collect${r.expiresAt ? ` by ${day(r.expiresAt)}` : ''}`} tone="success" /> : <Text variant="small" tone="muted">Number {r.position} in the queue</Text>}
              <Button label="Cancel reservation" variant="ghost" loading={busy} onPress={() => void run(async () => { await libraryApi.cancelReservation(r.id); q.refresh(); })} />
            </Card>
          ))}
          {d.fines.filter((f) => f.outstanding > 0).map((f) => (
            <Card key={f.id}>
              <Text variant="label">{f.reason === 'OVERDUE' ? 'Late return' : f.reason === 'LOST' ? 'Lost book' : 'Damaged book'}: {formatCedis(f.outstanding)}</Text>
              {f.note ? <Text variant="small" tone="muted">{f.note}</Text> : null}
              <Button label={`Pay ${formatCedis(f.outstanding)} online`} loading={busy} onPress={() => void run(async () => { await openPayment((await axiosInstance.post<{ paymentUrl: string }>(`/me/library/fines/${f.id}/pay-online`)).data.paymentUrl); setPaying(true); })} />
            </Card>
          ))}
        </View>
      )}
    </QueryView>
  );
}
