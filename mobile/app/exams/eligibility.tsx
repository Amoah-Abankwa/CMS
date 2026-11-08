import { useState } from 'react';
import { View } from 'react-native';
import { examsApi, type EligibilityView } from '@/api/exams';
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

export default function Eligibility() {
  const { space } = useTheme();
  const [filter, setFilter] = useState<'NOT_ELIGIBLE' | 'UNPUBLISHED' | ''>('NOT_ELIGIBLE');
  const q = useQuery<EligibilityView>(`exams.elig.${filter}`, '/exams/eligibility', { page: 1, pageSize: 50, filter: filter || undefined });
  const [msg, setMsg] = useState<string | null>(null);
  const [overriding, setOverriding] = useState<{ id: string; to: 'ELIGIBLE' | 'NOT_ELIGIBLE'; reason: string } | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exam eligibility" subtitle={q.data ? `${q.data.counts.fullyEligible} of ${q.data.counts.students} students eligible for everything.` : undefined} />
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button label="Work it out again" variant="secondary" loading={busy} onPress={() => void run(async () => { await examsApi.generate(); setMsg('Eligibility worked out from fees and attendance.'); q.refresh(); })} /></View>
        <View style={{ flex: 1 }}><Button label="Publish" loading={busy} onPress={() => void run(async () => { const r = await examsApi.publishEligibility(); setMsg(`Published. ${r.notified} students told.`); q.refresh(); })} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Not eligible" selected={filter === 'NOT_ELIGIBLE'} onPress={() => setFilter('NOT_ELIGIBLE')} />
        <Chip label="Not published" selected={filter === 'UNPUBLISHED'} onPress={() => setFilter('UNPUBLISHED')} />
        <Chip label="Everyone" selected={filter === ''} onPress={() => setFilter('')} />
      </View>
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="Nobody here" why={filter === 'NOT_ELIGIBLE' ? 'Every student is eligible for every paper.' : 'Nothing matches this filter.'} /> : <>{d.items.map((s) => (
          <Card key={s.student.id}>
            <Text variant="label">{s.student.firstName} {s.student.lastName} <Text variant="small" tone="muted">{s.student.indexNumber}</Text></Text>
            {s.papers.filter((p) => filter !== 'NOT_ELIGIBLE' || p.status === 'NOT_ELIGIBLE').map((p) => (
              <View key={p.id} style={{ gap: 4 }}>
                <Text variant="small">{p.offering.course.code}: {p.status === 'ELIGIBLE' ? 'eligible' : p.reasons.map((r) => r.text).join(' ')}{p.override ? ` (override: ${p.override.reason})` : ''}</Text>
                {p.unpublished ? <Badge label="Changed, not published" tone="warning" /> : null}
                {overriding?.id === p.id ? (
                  <View style={{ gap: 4 }}>
                    <TextField label="Reason for the override" value={overriding.reason} onChangeText={(x) => setOverriding({ ...overriding, reason: x })} error={overriding.reason && overriding.reason.trim().length < 5 ? 'At least 5 characters.' : null} />
                    <Button label={`Make ${overriding.to === 'ELIGIBLE' ? 'eligible' : 'not eligible'}`} disabled={overriding.reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { await examsApi.override(p.id, overriding.to, overriding.reason.trim()); setOverriding(null); q.refresh(); })} />
                    <Button label="Cancel" variant="ghost" onPress={() => setOverriding(null)} />
                  </View>
                ) : p.override ? <Button label="Remove override" variant="ghost" loading={busy} onPress={() => void run(async () => { await examsApi.clearOverride(p.id); q.refresh(); })} /> : (
                  <Button label={p.status === 'ELIGIBLE' ? 'Override: not eligible' : 'Override: let them sit it'} variant="ghost" onPress={() => setOverriding({ id: p.id, to: p.status === 'ELIGIBLE' ? 'NOT_ELIGIBLE' : 'ELIGIBLE', reason: '' })} />
                )}
              </View>
            ))}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
