import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { PayNow } from '@/features/finance/PayNow';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { openPdf } from '@/lib/files';
import { useTheme } from '@/theme/useTheme';

interface Sheet { id: string; period: string; amount: number; paidAt: string | null; paidReference: string | null; application: { payoutNetwork: string | null; payoutNumber: string | null; student: { firstName: string; lastName: string; indexNumber: string | null }; job: { title: string } } }

export default function Payroll() {
  const { space } = useTheme();
  const [status, setStatus] = useState<'APPROVED' | 'PAID'>('APPROVED');
  const q = useQuery<Sheet[]>(`fin.payroll.${status}`, '/payroll', { status });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Student payroll" subtitle={q.data && status === 'APPROVED' ? `To pay: ${formatCedis(q.data.reduce((t, s) => t + s.amount, 0))}` : 'Timesheets approved by supervisors.'} />
      <View style={{ flexDirection: 'row', gap: space.sm }}><Chip label="To pay" selected={status === 'APPROVED'} onPress={() => setStatus('APPROVED')} /><Chip label="Paid" selected={status === 'PAID'} onPress={() => setStatus('PAID')} /></View>
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(list) => list.length === 0 ? <EmptyState title={status === 'APPROVED' ? 'Nothing to pay' : 'Nothing paid yet'} why={status === 'APPROVED' ? 'Timesheets appear here once supervisors approve them.' : 'Paid timesheets appear here with their payslips.'} /> : <>{list.map((t) => <SheetCard key={t.id} t={t} paid={status === 'PAID'} onDone={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function SheetCard({ t, paid, onDone }: { t: Sheet; paid: boolean; onDone: () => void }) {
  const [byHand, setByHand] = useState(false);
  const [ref, setRef] = useState('');
  const { busy, error, run } = useSubmit();
  const s = t.application.student;
  return (
    <Card>
      <Text variant="label">{s.firstName} {s.lastName}, {t.application.job.title}</Text>
      <Text variant="small" tone="muted">{t.period}: {formatCedis(t.amount)}. {t.application.payoutNumber ? `To ${t.application.payoutNetwork} ${t.application.payoutNumber}` : 'No mobile money number yet'}{paid && t.paidReference ? `. Ref ${t.paidReference}` : ''}</Text>
      <FormError error={error} />
      {paid ? <Button label="Payslip (PDF)" variant="ghost" onPress={() => void run(() => openPdf(`/opportunities/timesheets/${t.id}/payslip`, `payslip-${s.indexNumber}-${t.period}.pdf`))} /> : (
        <>
          {t.application.payoutNumber ? <PayNow purpose="PAYROLL" subjectId={t.id} amount={t.amount} label={`${s.firstName} ${s.lastName}`} onDone={onDone} /> : null}
          {byHand ? (
            <>
              <TextField label="Transaction or payroll reference" value={ref} onChangeText={setRef} error={ref && ref.trim().length < 3 ? 'At least 3 characters.' : null} />
              <Button label="Record as paid" disabled={ref.trim().length < 3} loading={busy} onPress={() => void run(async () => { await axiosInstance.post(`/payroll/${t.id}/paid`, { reference: ref.trim() }); onDone(); })} />
            </>
          ) : <Button label="Paid another way: record it" variant="ghost" onPress={() => setByHand(true)} />}
        </>
      )}
    </Card>
  );
}
