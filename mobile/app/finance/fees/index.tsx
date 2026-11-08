import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { formatMoney } from '@anu/shared';
import { feesApi, type Bill, type FeeOptions } from '@/api/fees';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
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
import { useTheme } from '@/theme/useTheme';

type Status = '' | 'UNPAID' | 'PART' | 'PAID';
type Page = { items: Bill[]; total: number; page: number; pageSize: number; summary: { bills: number; cleared: number; byCurrency: Array<{ currency: 'GHS' | 'USD'; bills: number; due: number; collected: number }> } | null };

export default function StudentFees() {
  const { space } = useTheme();
  const options = useQuery<FeeOptions>('fees.options', '/fees/options');
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const sem = semesterId ?? options.data?.semesters.find((s) => s.isCurrent)?.id ?? options.data?.semesters[0]?.id ?? '';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [page, setPage] = useState(1);
  const q = useQuery<Page>(`fees.bills.${sem}.${search}.${status}.${page}`, '/fees/bills', { semesterId: sem || undefined, search: search.trim() || undefined, status: status || undefined, page });
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Student fees" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{(options.data?.semesters ?? []).map((s) => <Chip key={s.id} label={s.label} selected={sem === s.id} onPress={() => { setSemesterId(s.id); setPage(1); }} />)}</ScrollView>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <Button label="Issue bills for this semester" variant="secondary" disabled={!sem} loading={busy} onPress={() => void run(async () => { const r = await feesApi.issue(sem); setMsg(`${r.issued} bills issued, ${r.alreadyBilled} already billed${r.noSchedule ? `, ${r.noSchedule} students have no matching fee schedule (see Fee set-up)` : ''}.`); q.refresh(); })} />
      <TextField label="Find a student" value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Name or index number" />
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {(['', 'UNPAID', 'PART', 'PAID'] as Status[]).map((s) => <Chip key={s || 'all'} label={{ '': 'All', UNPAID: 'Nothing paid', PART: 'Part paid', PAID: 'Paid' }[s]} selected={status === s} onPress={() => { setStatus(s); setPage(1); }} />)}
      </View>
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => (
          <>
            {d.summary ? d.summary.byCurrency.map((c) => <Text key={c.currency} variant="small" tone="muted">{c.bills} bills: {formatMoney(c.collected, c.currency)} collected of {formatMoney(c.due, c.currency)}. {d.summary!.cleared} cleared for exams.</Text>) : null}
            {d.items.length === 0 ? <EmptyState title="No bills" why={search ? `No bill matches "${search}".` : 'Issue the semester\'s bills once the fee schedules are set.'} /> : d.items.map((b) => {
              return (
                <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/finance/fees/${b.id}` as never)}>
                  <Card style={{ padding: 12 }}>
                    <Text variant="label">{b.student.firstName} {b.student.lastName} <Text variant="small" tone="muted">{b.student.indexNumber}</Text></Text>
                    <Text variant="small" tone="muted">Paid {formatMoney(b.due - b.balance, b.currency)} of {formatMoney(b.due, b.currency)} ({b.percentPaid}%).</Text>
                    {b.balance <= 0 ? <Badge label="Paid" tone="success" /> : b.clearance?.cleared ? <Badge label="Cleared for exams" tone="primary" /> : null}
                  </Card>
                </Pressable>
              );
            })}
            {d.total > page * d.pageSize ? <Button label="More" variant="secondary" onPress={() => setPage(page + 1)} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
