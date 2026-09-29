'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis, OFFICE_LABEL, type AssociationOffice } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate, formatDateTime } from '@/lib/format';
import { feesApi, type AdminAssociation, type Receipt } from '../api';

type Dlg = { kind: 'edit'; a: AdminAssociation | null } | { kind: 'officer'; a: AdminAssociation } | { kind: 'end'; officerId: string; name: string } | { kind: 'receipts'; a: AdminAssociation };

export function AssociationsAdmin() {
  const [list, setList] = useState<AdminAssociation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const load = useCallback(() => { feesApi.associations().then(setList).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => { load(); }, [load]);
  const done = () => { setDlg(null); load(); };
  if (!list) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <div><Button size="sm" onClick={() => setDlg({ kind: 'edit', a: null })}>Add association</Button></div>
      {list.length === 0 && <EmptyState title="No associations yet" description="Add EHASSA, BACA and the others, with the departments each one represents." />}
      {list.map((a) => (
        <Card key={a.id}>
          <CardHeader title={`${a.code}: ${a.name}`} description={`${a.departments.map((d) => d.name).join(', ')}. ${a.members} students.`} actions={<Button variant="ghost" size="sm" onClick={() => setDlg({ kind: 'edit', a })}>Edit</Button>} />
          <CardBody className="flex flex-col gap-3 text-sm">
            <div>
              <p className="mb-1 font-medium">Officers</p>
              <p className="flex flex-wrap items-center gap-2">
                <span><span className="font-medium">Patron:</span> {a.patron ? `${a.patron.firstName} ${a.patron.lastName} (${a.patron.email ?? ''})` : 'none. The patron, a Head of Department of one of its departments, sets the dues.'}</span>
                <Button size="sm" variant="ghost" onClick={() => { const email = window.prompt(`Staff email of ${a.code}'s patron (a Head of Department of one of its departments). Leave empty to clear.`, a.patron?.email ?? ''); if (email === null) return; feesApi.setPatron(a.id, email.trim() || null).then(load).catch((err) => window.alert(errorMessage(err))); }}>{a.patron ? 'Change patron' : 'Name patron'}</Button>
              </p>
              {a.officers.length === 0 ? <p className="text-muted">None recorded. Record the elected president after the election.</p> : (
                <ul className="flex flex-col gap-1">
                  {a.officers.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{OFFICE_LABEL[o.office]}: {o.student.firstName} {o.student.lastName} ({o.student.indexNumber}), {formatDate(o.startsOn)} to {formatDate(o.endsOn)} {!o.current && <Badge>starts later</Badge>}</span>
                      <Button variant="ghost" size="sm" onClick={() => setDlg({ kind: 'end', officerId: o.id, name: `${o.student.firstName} ${o.student.lastName}` })}>End term</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {a.levies.length > 0 && <p className="text-muted">This semester: {a.levies.map((l) => `${l.title}, ${l.paidCount} paid (online ${formatCedis(l.online)}, cash ${formatCedis(l.cash)})`).join('; ')}.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDlg({ kind: 'officer', a })}>Record elected officer</Button>
              <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'receipts', a })}>Receipts</Button>
            </div>
          </CardBody>
        </Card>
      ))}
      {dlg?.kind === 'edit' && <EditDialog a={dlg.a} onClose={() => setDlg(null)} onDone={done} />}
      {dlg?.kind === 'officer' && <OfficerDialog a={dlg.a} onClose={() => setDlg(null)} onDone={done} />}
      {dlg?.kind === 'end' && <ReasonDialog title={`End ${dlg.name}'s term?`} action="End term" onClose={() => setDlg(null)} submit={(r) => feesApi.endTerm(dlg.officerId, r).then(done)} />}
      {dlg?.kind === 'receipts' && <ReceiptsDialog a={dlg.a} onClose={() => { setDlg(null); load(); }} />}
    </div>
  );
}

function EditDialog({ a, onClose, onDone }: { a: AdminAssociation | null; onClose: () => void; onDone: () => void }) {
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [f, setF] = useState({ code: a?.code ?? '', name: a?.name ?? '', description: a?.description ?? '', departmentIds: a?.departments.map((d) => d.id) ?? [], payoutNetwork: a?.payoutNetwork ?? '', payoutNumber: a?.payoutNumber ?? '', payoutName: a?.payoutName ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { feesApi.departments().then(setDepts).catch(() => undefined); }, []);
  const save = async () => {
    setBusy(true);
    try {
      await feesApi.saveAssociation({ ...f, code: f.code.trim().toUpperCase(), description: f.description || undefined, payoutNetwork: f.payoutNetwork || undefined, payoutNumber: f.payoutNumber || undefined, payoutName: f.payoutName || undefined }, a?.id);
      onDone();
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={a ? `Edit ${a.code}` : 'Add association'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Short name" htmlFor="as-code"><Input id="as-code" value={f.code} maxLength={10} placeholder="EHASSA" onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <div className="sm:col-span-2"><Field label="Full name" htmlFor="as-name"><Input id="as-name" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Departments it represents</legend>
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
            {depts.map((d) => <label key={d.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.departmentIds.includes(d.id)} onChange={(e) => setF({ ...f, departmentIds: e.target.checked ? [...f.departmentIds, d.id] : f.departmentIds.filter((x) => x !== d.id) })} /> {d.name}</label>)}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Payout network" htmlFor="as-net"><Select id="as-net" value={f.payoutNetwork} onChange={(e) => setF({ ...f, payoutNetwork: e.target.value })}><option value="">Not set</option><option value="MTN">MTN MoMo</option><option value="Telecel">Telecel Cash</option><option value="AirtelTigo">AirtelTigo Money</option></Select></Field>
          <Field label="Mobile money number" htmlFor="as-num"><Input id="as-num" type="tel" value={f.payoutNumber} onChange={(e) => setF({ ...f, payoutNumber: e.target.value })} /></Field>
          <Field label="Account name" htmlFor="as-pname"><Input id="as-pname" value={f.payoutName} maxLength={80} onChange={(e) => setF({ ...f, payoutName: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-muted">Online dues are paid to this number by Finance. Use the association's own account, not an officer's personal one.</p>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!/^[A-Z][A-Z0-9]{1,9}$/.test(f.code) || f.name.trim().length < 3 || !f.departmentIds.length} onClick={save}>Save</Button></div>
      </div>
    </Dialog>
  );
}

function OfficerDialog({ a, onClose, onDone }: { a: AdminAssociation; onClose: () => void; onDone: () => void }) {
  const year = new Date().getUTCFullYear();
  const [f, setF] = useState({ indexNumber: '', office: 'PRESIDENT' as AssociationOffice, startsOn: new Date().toISOString().slice(0, 10), endsOn: `${year + 1}-08-31` });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await feesApi.appoint(a.id, { ...f, indexNumber: f.indexNumber.trim().toUpperCase() }); onDone(); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={`Record ${a.code} officer`} description="After the election. They get the dues screen for their term only; the outgoing officer in the same office loses it when the new term starts.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Index number" htmlFor="of-idx"><Input id="of-idx" value={f.indexNumber} onChange={(e) => setF({ ...f, indexNumber: e.target.value })} /></Field>
          <Field label="Office" htmlFor="of-off"><Select id="of-off" value={f.office} onChange={(e) => setF({ ...f, office: e.target.value as AssociationOffice })}><option value="PRESIDENT">President</option><option value="TREASURER">Treasurer</option></Select></Field>
          <Field label="Term starts" htmlFor="of-s"><Input id="of-s" type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} /></Field>
          <Field label="Term ends" htmlFor="of-e"><Input id="of-e" type="date" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={f.indexNumber.trim().length < 8} onClick={save}>Record officer</Button></div>
      </div>
    </Dialog>
  );
}

function ReasonDialog({ title, action, onClose, submit }: { title: string; action: string; onClose: () => void; submit: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason (the student sees it)" htmlFor="rs-r"><Textarea id="rs-r" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Back</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={async () => { setBusy(true); try { await submit(reason.trim()); } catch (err) { setError(errorMessage(err)); setBusy(false); } }}>{action}</Button></div>
      </div>
    </Dialog>
  );
}

function ReceiptsDialog({ a, onClose }: { a: AdminAssociation; onClose: () => void }) {
  const [rows, setRows] = useState<Receipt[] | null>(null);
  const [voiding, setVoiding] = useState<Receipt | null>(null);
  const load = useCallback(() => { feesApi.receipts(a.id).then(setRows).catch(() => setRows([])); }, [a.id]);
  useEffect(() => { load(); }, [load]);
  return (
    <Dialog open onClose={onClose} title={`${a.code} receipts`} description="Only this office can cancel a receipt. Online payments are refunded; the student and officers are told.">
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-muted">No receipts yet.</p> : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <span>{r.receiptNumber}: {r.student.firstName} {r.student.lastName} ({r.student.indexNumber}), {r.method === 'CASH' ? 'cash' : 'online'}<span className="block text-xs text-muted">{r.levy.title}, {formatDateTime(r.createdAt)}{r.voidedAt ? `. Cancelled: ${r.voidReason}` : ''}</span></span>
              <span className="flex items-center gap-2"><span className={`tabular-nums ${r.voidedAt ? 'text-muted line-through' : ''}`}>{formatCedis(r.amount)}</span>{!r.voidedAt && <Button variant="ghost" size="sm" onClick={() => setVoiding(r)}>Cancel</Button>}</span>
            </li>
          ))}
        </ul>
      )}
      {voiding && <ReasonDialog title={`Cancel receipt ${voiding.receiptNumber}?`} action="Cancel receipt" onClose={() => setVoiding(null)} submit={(reason) => feesApi.voidReceipt(voiding.id, reason).then(() => { setVoiding(null); load(); })} />}
    </Dialog>
  );
}
