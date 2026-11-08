import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { formatCedis, OFFICE_LABEL, type AssociationOffice } from '@anu/shared';
import { feesApi, type AdminAssociation, type Receipt } from '@/api/fees';
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
import { validate } from '@/lib/validate';
import { useTheme } from '@/theme/useTheme';

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function Associations() {
  const q = useQuery<AdminAssociation[]>('assoc.admin', '/associations');
  const depts = useQuery<Array<{ id: string; name: string }>>('assoc.depts', '/associations/departments');
  const [editing, setEditing] = useState<AdminAssociation | 'new' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Departmental associations" subtitle="Each association's departments, patron, officers and receipts." />
      {editing ? <AssocForm a={editing === 'new' ? null : editing} departments={depts.data ?? []} onDone={() => { setEditing(null); q.refresh(); }} /> : (
        <>
          <Button label="Add an association" onPress={() => setEditing('new')} />
          <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
            {(list) => list.length === 0 ? <EmptyState title="No associations yet" why="Add each departmental association with the departments whose students belong." /> : <>{list.map((a) => (
              <Card key={a.id}>
                <Text variant="heading">{a.code}: {a.name}{a.isActive ? '' : ' (inactive)'}</Text>
                <Text variant="small" tone="muted">{a.departments.map((d) => d.name).join(', ')}. {a.members} students.</Text>
                <Text variant="small">Patron: {a.patron ? `${a.patron.firstName} ${a.patron.lastName}` : 'not named yet'}</Text>
                {a.officers.filter((o) => o.current).map((o) => <Text key={o.id} variant="small">{OFFICE_LABEL[o.office]}: {o.student.firstName} {o.student.lastName} until {o.endsOn.slice(0, 10)}</Text>)}
                {open === a.id ? <Manage a={a} onChange={q.refresh} onClose={() => setOpen(null)} /> : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}><Button label="Manage" variant="secondary" onPress={() => setOpen(a.id)} /></View>
                    <View style={{ flex: 1 }}><Button label="Edit" variant="ghost" onPress={() => setEditing(a)} /></View>
                  </View>
                )}
              </Card>
            ))}</>}
          </QueryView>
        </>
      )}
    </Screen>
  );
}

function AssocForm({ a, departments, onDone }: { a: AdminAssociation | null; departments: Array<{ id: string; name: string }>; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ code: a?.code ?? '', name: a?.name ?? '', departmentIds: a?.departments.map((d) => d.id) ?? [] as string[], payoutNetwork: a?.payoutNetwork ?? '', payoutNumber: a?.payoutNumber ?? '', payoutName: a?.payoutName ?? '' });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { code: /^[A-Z0-9]{2,10}$/.test(f.code) ? null : '2 to 10 capitals or digits, e.g. COMPSSA.', name: f.name.trim().length >= 3 ? null : 'At least 3 letters.', depts: f.departmentIds.length ? null : 'Choose at least one department.', momo: !f.payoutNumber || /^(\+?233|0)\d{9}$/.test(f.payoutNumber.replace(/\s/g, '')) ? null : 'A Ghana mobile money number.' };
  return (
    <Card>
      <FormError error={error} />
      <TextField label="Short name" value={f.code} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, code: x.toUpperCase() })} error={touched ? errs.code : null} />
      <TextField label="Full name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      <Text variant="label">Departments</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{departments.map((d) => <Chip key={d.id} label={d.name} selected={f.departmentIds.includes(d.id)} onPress={() => setF({ ...f, departmentIds: f.departmentIds.includes(d.id) ? f.departmentIds.filter((x) => x !== d.id) : [...f.departmentIds, d.id] })} />)}</View>
      {touched && errs.depts ? <Text variant="small" tone="danger">{errs.depts}</Text> : null}
      <TextField label="Payout network (optional)" value={f.payoutNetwork} onChangeText={(x) => setF({ ...f, payoutNetwork: x })} placeholder="MTN" />
      <TextField label="Payout mobile money number" value={f.payoutNumber} keyboardType="phone-pad" onChangeText={(x) => setF({ ...f, payoutNumber: x })} error={touched ? errs.momo : null} />
      <TextField label="Name on the account" value={f.payoutName} onChangeText={(x) => setF({ ...f, payoutName: x })} />
      <Button label="Save" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await feesApi.saveAssociation({ code: f.code, name: f.name.trim(), departmentIds: f.departmentIds, payoutNetwork: f.payoutNetwork.trim() || undefined, payoutNumber: f.payoutNumber.replace(/\s/g, '') || undefined, payoutName: f.payoutName.trim() || undefined }, a?.id); onDone(); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}

function Manage({ a, onChange, onClose }: { a: AdminAssociation; onChange: () => void; onClose: () => void }) {
  const { space } = useTheme();
  const [patron, setPatron] = useState(a.patron?.email ?? '');
  const [officer, setOfficer] = useState({ indexNumber: '', office: 'PRESIDENT' as AssociationOffice, startsOn: new Date().toISOString().slice(0, 10), endsOn: '' });
  const [ending, setEnding] = useState<{ id: string; reason: string } | null>(null);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const offErr = { index: officer.indexNumber && !/^[A-Za-z]{2,6}\d{6,9}$/.test(officer.indexNumber.trim()) ? 'An index number looks like ANU25400001.' : null, dates: officer.endsOn && (!isDate(officer.startsOn) || !isDate(officer.endsOn) || officer.endsOn <= officer.startsOn) ? 'The term ends after it starts (YYYY-MM-DD).' : null };
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <Text variant="label">Patron (a Head of Department)</Text>
      <TextField label="Their email" value={patron} autoCapitalize="none" keyboardType="email-address" onChangeText={setPatron} error={patron ? validate.email(patron) : null} />
      <Button label="Name as patron" variant="secondary" disabled={!patron || !!validate.email(patron)} loading={busy} onPress={() => void run(async () => { await feesApi.setPatron(a.id, patron.trim().toLowerCase()); setMsg('Patron named; they set the dues.'); onChange(); })} />
      <Text variant="label">Officers</Text>
      {a.officers.filter((o) => o.current).map((o) => (
        <View key={o.id} style={{ gap: 4 }}>
          <Text variant="small">{OFFICE_LABEL[o.office]}: {o.student.firstName} {o.student.lastName}</Text>
          {ending?.id === o.id ? (
            <>
              <TextField label="Why the term ends early" value={ending.reason} onChangeText={(x) => setEnding({ ...ending, reason: x })} error={ending.reason && ending.reason.trim().length < 5 ? 'At least 5 characters.' : null} />
              <Button label="End the term" variant="danger" disabled={ending.reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { await feesApi.endTerm(o.id, ending.reason.trim()); setEnding(null); onChange(); })} />
            </>
          ) : <Button label="End term" variant="ghost" onPress={() => setEnding({ id: o.id, reason: '' })} />}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm }}>{(Object.keys(OFFICE_LABEL) as AssociationOffice[]).map((o) => <Chip key={o} label={OFFICE_LABEL[o]} selected={officer.office === o} onPress={() => setOfficer({ ...officer, office: o })} />)}</View>
      <TextField label="Student's index number" value={officer.indexNumber} autoCapitalize="characters" onChangeText={(x) => setOfficer({ ...officer, indexNumber: x })} error={offErr.index} />
      <TextField label="Term starts" value={officer.startsOn} onChangeText={(x) => setOfficer({ ...officer, startsOn: x })} />
      <TextField label="Term ends" value={officer.endsOn} placeholder="YYYY-MM-DD" onChangeText={(x) => setOfficer({ ...officer, endsOn: x })} error={offErr.dates} />
      <Button label={`Appoint ${OFFICE_LABEL[officer.office].toLowerCase()}`} disabled={!officer.indexNumber || !officer.endsOn || !!offErr.index || !!offErr.dates} loading={busy} onPress={() => void run(async () => { await feesApi.appoint(a.id, { ...officer, indexNumber: officer.indexNumber.trim().toUpperCase() }); setMsg('Officer appointed; they can now record cash.'); setOfficer({ ...officer, indexNumber: '', endsOn: '' }); onChange(); })} />
      {receiptsOpen ? <Receipts associationId={a.id} /> : <Button label="Receipts" variant="secondary" onPress={() => setReceiptsOpen(true)} />}
      <Button label="Close" variant="ghost" onPress={onClose} />
    </View>
  );
}

function Receipts({ associationId }: { associationId: string }) {
  const q = useQuery<Receipt[]>(`assoc.receipts.${associationId}`, `/associations/${associationId}/receipts`);
  const [voiding, setVoiding] = useState<{ id: string; reason: string } | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
      {(list) => list.length === 0 ? <Text tone="muted">No receipts yet.</Text> : (
        <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
          <FormError error={error} />
          {list.map((r) => (
            <View key={r.id} style={{ gap: 4, paddingVertical: 6 }}>
              <Text variant="small">{r.receiptNumber}: {formatCedis(r.amount)} {r.method === 'CASH' ? 'cash' : 'online'} from {r.student.firstName} {r.student.lastName}, {r.levy.title}</Text>
              {r.voidedAt ? <Badge label={`Cancelled: ${r.voidReason ?? ''}`} /> : voiding?.id === r.id ? (
                <>
                  <TextField label="Why it is cancelled" value={voiding.reason} onChangeText={(x) => setVoiding({ ...voiding, reason: x })} error={voiding.reason && voiding.reason.trim().length < 5 ? 'At least 5 characters.' : null} />
                  <Button label="Cancel the receipt" variant="danger" disabled={voiding.reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { await feesApi.voidReceipt(r.id, voiding.reason.trim()); setVoiding(null); q.refresh(); })} />
                </>
              ) : r.method === 'CASH' ? <Button label="Cancel receipt" variant="ghost" onPress={() => setVoiding({ id: r.id, reason: '' })} /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </QueryView>
  );
}
