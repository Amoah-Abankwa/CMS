import { useState } from 'react';
import { View } from 'react-native';
import { PRIORITY_LABELS } from '@anu/shared';
import { accommodationApi, type AllocationRow, type ApplicationRow, type Round, type RunSummary, type UniversityHostel } from '@/api/accommodation';
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
import { RoomPicker } from '@/features/hostels/RoomPicker';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const STATUS: Record<AllocationRow['status'], string> = { PROVISIONAL: 'Not yet published', OFFERED: 'Offered', ACCEPTED: 'Accepted', DECLINED: 'Declined', EXPIRED: 'Offer expired', CANCELLED: 'Cancelled' };

export default function Allocation() {
  const { space } = useTheme();
  const [tab, setTab] = useState<'round' | 'applications' | 'allocations'>('applications');
  return (
    <Screen>
      <Header title="Applications and allocation" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label="Round" selected={tab === 'round'} onPress={() => setTab('round')} />
        <Chip label="Applications" selected={tab === 'applications'} onPress={() => setTab('applications')} />
        <Chip label="Allocations" selected={tab === 'allocations'} onPress={() => setTab('allocations')} />
      </View>
      {tab === 'round' ? <RoundSettings /> : tab === 'applications' ? <Applications /> : <Allocations />}
    </Screen>
  );
}

function RoundSettings() {
  const q = useQuery<Round>('hostels.round', '/hostels/round');
  const [f, setF] = useState<{ opens: string; closes: string; days: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={2} />}>
      {(r) => {
        const v = f ?? { opens: r.round?.opensAt.slice(0, 10) ?? '', closes: r.round?.closesAt.slice(0, 10) ?? '', days: String(r.round?.acceptanceDays ?? 7) };
        const errs = { dates: /^\d{4}-\d{2}-\d{2}$/.test(v.opens) && /^\d{4}-\d{2}-\d{2}$/.test(v.closes) && v.closes > v.opens ? null : 'Opening and closing dates as YYYY-MM-DD, closing after opening.', days: Number.isInteger(Number(v.days)) && Number(v.days) >= 1 && Number(v.days) <= 30 ? null : 'From 1 to 30 days.' };
        return (
          <Card>
            <Text variant="heading">{r.semester.label}: {r.open ? 'applications open' : 'applications closed'}</Text>
            {r.round?.lastRunAt ? <Text variant="small" tone="muted">Last allocated {new Date(r.round.lastRunAt).toLocaleString()}{r.round.lastPublishedAt ? `, published ${new Date(r.round.lastPublishedAt).toLocaleString()}` : ''}.</Text> : null}
            <FormError error={error} />
            {saved ? <Notice tone="success">Round saved.</Notice> : null}
            <TextField label="Applications open" value={v.opens} placeholder="YYYY-MM-DD" onChangeText={(x) => setF({ ...v, opens: x })} />
            <TextField label="Applications close" value={v.closes} placeholder="YYYY-MM-DD" onChangeText={(x) => setF({ ...v, closes: x })} error={errs.dates} />
            <TextField label="Days to accept an offer" value={v.days} keyboardType="number-pad" onChangeText={(x) => setF({ ...v, days: x })} error={errs.days} />
            <Button label="Save round" disabled={!!errs.dates || !!errs.days} loading={busy} onPress={() => void run(async () => { await accommodationApi.saveRound({ opensAt: new Date(`${v.opens}T00:00:00`).toISOString(), closesAt: new Date(`${v.closes}T23:59:00`).toISOString(), acceptanceDays: Number(v.days) }); setSaved(true); q.refresh(); })} />
          </Card>
        );
      }}
    </QueryView>
  );
}

function Applications() {
  const [search, setSearch] = useState('');
  const q = useQuery<{ counts: Record<string, number>; total: number; items: ApplicationRow[] }>(`hostels.apps.${search}`, '/hostels/applications', { search: search.trim() || undefined, page: 1, pageSize: 50 });
  const { busy, error, run } = useSubmit();
  return (
    <>
      <TextField label="Find an applicant" value={search} onChangeText={setSearch} placeholder="Name or index number" />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => (
          <>
            <Text variant="small" tone="muted">{Object.entries(d.counts).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ')}</Text>
            {d.items.length === 0 ? <EmptyState title="No applications" why="Students apply while the round is open." /> : d.items.map((a) => (
              <Card key={a.id} style={{ padding: 10 }}>
                <Text variant="label">{a.student.firstName} {a.student.lastName} <Text variant="small" tone="muted">{a.student.indexNumber}</Text></Text>
                <Text variant="small" tone="muted">{PRIORITY_LABELS[a.group]}. Wants {a.preferences.map((p) => p.hostelName).join(', then ')}{a.acceptAny ? ', or any hostel' : ''}.</Text>
                <Badge label={a.status.toLowerCase()} />
                {a.specialNeeds ? (
                  <>
                    <Text variant="small">Special needs: {a.specialNeeds}</Text>
                    <Button label={a.specialNeedsApproved ? 'Confirmed (undo)' : 'Confirm special needs'} variant="secondary" loading={busy} onPress={() => void run(async () => { await accommodationApi.specialNeeds(a.id, !a.specialNeedsApproved); q.refresh(); })} />
                  </>
                ) : null}
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </>
  );
}

function Allocations() {
  const { space } = useTheme();
  const q = useQuery<{ items: AllocationRow[] }>('hostels.allocations', '/hostels/allocations');
  const hostels = useQuery<{ items: UniversityHostel[] }>('hostels.list', '/hostels');
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState<{ index: string; roomId: string | null } | null>(null);
  const [acting, setActing] = useState<{ id: string; kind: 'move' | 'cancel'; roomId: string | null; reason: string } | null>(null);
  const { busy, error, run } = useSubmit();
  const provisional = (q.data?.items ?? []).filter((a) => a.status === 'PROVISIONAL').length;
  const refresh = () => { q.refresh(); hostels.refresh(); };
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {summary ? <Notice tone="info" title="Allocation run">{`${summary.placed} of ${summary.applicants} placed: ${summary.firstChoice} got their first choice, ${summary.anyHostel} went to any hostel. Unplaced: ${summary.unplaced.noBed} for lack of beds, ${summary.unplaced.noGender} with no hostel for them.`}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button label="Run allocation" variant="secondary" loading={busy} onPress={() => void run(async () => { setSummary(await accommodationApi.run()); refresh(); })} /></View>
        <View style={{ flex: 1 }}><Button label={`Publish ${provisional} offers`} disabled={!provisional} loading={busy} onPress={() => void run(async () => { const r = await accommodationApi.publish(); setMsg(`${r.offered} offers sent; they accept by ${new Date(r.acceptBy).toLocaleDateString()}.`); refresh(); })} /></View>
      </View>
      {manual ? (
        <Card>
          <Text variant="heading">Place a student by hand</Text>
          <TextField label="Index number" value={manual.index} autoCapitalize="characters" onChangeText={(x) => setManual({ ...manual, index: x })} error={manual.index && !/^[A-Za-z]{2,6}\d{6,9}$/.test(manual.index.trim()) ? 'An index number looks like ANU25400001.' : null} />
          <RoomPicker hostels={hostels.data?.items ?? []} value={manual.roomId} onChange={(roomId) => setManual({ ...manual, roomId })} />
          <Button label="Place them" disabled={!manual.roomId || !/^[A-Za-z]{2,6}\d{6,9}$/.test(manual.index.trim())} loading={busy} onPress={() => void run(async () => { await accommodationApi.manual(manual.index.trim().toUpperCase(), manual.roomId!); setMsg('Placed. Publish to send the offer.'); setManual(null); refresh(); })} />
          <Button label="Cancel" variant="ghost" onPress={() => setManual(null)} />
        </Card>
      ) : <Button label="Place a student by hand" variant="ghost" onPress={() => setManual({ index: '', roomId: null })} />}
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No allocations yet" why="Run the allocation after applications close." /> : <>{d.items.map((a) => (
          <Card key={a.id} style={{ padding: 10 }}>
            <Text variant="label">{a.student.firstName} {a.student.lastName} <Text variant="small" tone="muted">{a.student.indexNumber}</Text></Text>
            <Text variant="small" tone="muted">{a.room.hostel.name}, room {a.room.number}{a.preferenceRank ? `, choice ${a.preferenceRank}` : a.source === 'MANUAL' ? ', placed by hand' : ''}</Text>
            <Badge label={STATUS[a.status]} tone={a.status === 'ACCEPTED' ? 'success' : a.status === 'OFFERED' ? 'primary' : 'neutral'} />
            {acting?.id === a.id ? (
              <View style={{ gap: space.sm }}>
                {acting.kind === 'move' ? <RoomPicker hostels={hostels.data?.items ?? []} value={acting.roomId} onChange={(roomId) => setActing({ ...acting, roomId })} /> : <TextField label="Why it is cancelled (the student sees it)" value={acting.reason} onChangeText={(x) => setActing({ ...acting, reason: x })} error={acting.reason && acting.reason.trim().length < 5 ? 'At least 5 characters.' : null} />}
                <Button label={acting.kind === 'move' ? 'Move here' : 'Cancel the allocation'} variant={acting.kind === 'move' ? 'primary' : 'danger'} disabled={acting.kind === 'move' ? !acting.roomId : acting.reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { if (acting.kind === 'move') await accommodationApi.move(a.id, acting.roomId!); else await accommodationApi.cancelAllocation(a.id, acting.reason.trim()); setActing(null); refresh(); })} />
                <Button label="Back" variant="ghost" onPress={() => setActing(null)} />
              </View>
            ) : ['PROVISIONAL', 'OFFERED', 'ACCEPTED'].includes(a.status) ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="Move" variant="ghost" onPress={() => setActing({ id: a.id, kind: 'move', roomId: null, reason: '' })} />
                <Button label="Cancel" variant="ghost" onPress={() => setActing({ id: a.id, kind: 'cancel', roomId: null, reason: '' })} />
              </View>
            ) : null}
          </Card>
        ))}</>}
      </QueryView>
    </View>
  );
}
