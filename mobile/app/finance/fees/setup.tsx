import { useState } from 'react';
import { ScrollView } from 'react-native';
import { formatMoney, STUDENT_GROUP_LABEL } from '@anu/shared';
import { feesApi, type FeeItem, type FeeOptions, type Schedule } from '@/api/fees';
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
import { FeeRulesForm } from '@/features/feesetup/FeeRulesForm';
import { Instalments } from '@/features/feesetup/Instalments';
import { ScheduleForm } from '@/features/feesetup/ScheduleForm';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export default function FeeSetup() {
  const { space } = useTheme();
  const options = useQuery<FeeOptions>('fees.options', '/fees/options');
  const items = useQuery<FeeItem[]>('fees.items', '/fees/items');
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const sems = options.data?.semesters ?? [];
  const sem = semesterId ?? sems.find((s) => s.isCurrent)?.id ?? sems[0]?.id ?? '';
  const q = useQuery<Schedule[]>(`fees.schedules.${sem}`, '/fees/schedules', { semesterId: sem || undefined });
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const prev = sems[sems.findIndex((s) => s.id === sem) + 1];
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Fee set-up" subtitle="Fee schedules, instalments and payment rules for each semester." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{sems.map((s) => <Chip key={s.id} label={s.label} selected={sem === s.id} onPress={() => setSemesterId(s.id)} />)}</ScrollView>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {editing && options.data ? <ScheduleForm semesterId={sem} s={editing === 'new' ? null : editing} items={items.data ?? []} options={options.data} onDone={() => { setEditing(null); q.refresh(); }} /> : (
        <>
          <Button label="New fee schedule" onPress={() => setEditing('new')} />
          {prev ? <Button label={`Copy schedules from ${prev.label}`} variant="secondary" loading={busy} onPress={() => void run(async () => { const r = await feesApi.copySchedules(prev.id, sem); setMsg(`${r.copied} copied, ${r.skipped} already here.`); q.refresh(); })} /> : null}
          <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
            {(list) => list.length === 0 ? <EmptyState title="No fee schedules" why="Bills can only be issued once schedules say who pays what. Create one, or copy last semester's." /> : <>{list.map((s) => (
              <Card key={s.id}>
                <Text variant="heading">{s.name}</Text>
                <Text variant="small" tone="muted">{STUDENT_GROUP_LABEL[s.studentGroup]}, {s.programme?.name ?? 'every programme'}, {s.level ? `level ${s.level}` : 'every level'}. {s._count.bills} bills.</Text>
                <Text variant="label">{formatMoney(s.lines.reduce((t, l) => t + l.amount, 0), s.currency)}</Text>
                <Button label="Edit" variant="ghost" onPress={() => setEditing(s)} />
                {s._count.bills === 0 ? <Button label="Delete" variant="ghost" loading={busy} onPress={() => void run(async () => { await feesApi.deleteSchedule(s.id); q.refresh(); })} /> : null}
              </Card>
            ))}</>}
          </QueryView>
          {sem ? <Instalments key={sem} semesterId={sem} /> : null}
          <FeeRulesForm />
        </>
      )}
    </Screen>
  );
}
