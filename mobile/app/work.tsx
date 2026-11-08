import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis, TIMESHEET_STATUS_LABEL } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TimesheetEditor } from '@/features/work/TimesheetEditor';
import type { Hire, Sheet } from '@/features/work/types';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { openPdf } from '@/lib/files';
import { useTheme } from '@/theme/useTheme';

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function Work() {
  const q = useQuery<Hire[]>('work.hires', '/me/timesheets');
  const [editing, setEditing] = useState<{ hire: Hire; sheet: Sheet } | null>(null);
  const { busy, error, run } = useSubmit();
  const { space } = useTheme();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="My work" subtitle="Your jobs, monthly timesheets and payslips." />
      <FormError error={error} />
      {editing ? <TimesheetEditor hire={editing.hire} sheet={editing.sheet} onDone={() => { setEditing(null); q.refresh(); }} /> : (
        <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
          {(hires) => hires.length === 0 ? <EmptyState title="No jobs yet" why="Once you are hired for a campus job, your timesheets and payslips appear here." /> : <>{hires.map((h) => (
            <Card key={h.id}>
              <Text variant="heading">{h.job.title}</Text>
              <Text variant="small" tone="muted">{h.job.unit}. Paid to {h.payoutNumber ? `${h.payoutNetwork} ${h.payoutNumber}` : 'no mobile money number yet: add one on the website'}</Text>
              {h.timesheets.map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                  <Text style={{ flex: 1 }}>{s.period}: {formatCedis(s.amount)}</Text>
                  <Badge label={TIMESHEET_STATUS_LABEL[s.status]} tone={s.status === 'PAID' ? 'success' : s.status === 'RETURNED' ? 'warning' : 'neutral'} />
                  {s.status === 'DRAFT' || s.status === 'RETURNED' ? <Button label="Edit" variant="ghost" onPress={() => setEditing({ hire: h, sheet: s })} /> : null}
                  {s.status === 'PAID' ? <Button label="Payslip" variant="ghost" onPress={() => void run(() => openPdf(`/opportunities/timesheets/${s.id}/payslip`, `payslip-${s.period}.pdf`))} /> : null}
                </View>
              ))}
              {h.status === 'HIRED' && !h.timesheets.some((s) => s.period === thisMonth()) ? <Button label={`Start ${thisMonth()} timesheet`} variant="secondary" loading={busy} onPress={() => void run(async () => setEditing({ hire: h, sheet: (await axiosInstance.post<Sheet>(`/me/timesheets/jobs/${h.id}/open`, { period: thisMonth() })).data }))} /> : null}
            </Card>
          ))}</>}
        </QueryView>
      )}
    </Screen>
  );
}
