'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis, OFFICE_LABEL } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { downloadCsv } from '@/lib/csv';
import { formatDate } from '@/lib/format';
import { feesApi, type LevyMembers, type Office } from '../api';

/** An elected officer's dues screen: set dues, see who has paid, record cash with a receipt. */
export function OfficerDues() {
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLevy, setNewLevy] = useState<Office | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => { feesApi.offices().then(setOffices).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => { load(); }, [load]);
  if (!offices) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  if (!offices.length) return <EmptyState title="No current office" description="Your term may have ended. Contact the Dean of Students office." />;
  return (
    <div className="flex flex-col gap-4">
      {offices.map((o) => (
        <Card key={o.association.id}>
          <CardHeader title={`${o.association.code}: ${o.association.name}`} description={`You are ${OFFICE_LABEL[o.office]} until ${formatDate(o.endsOn)}. ${o.members} students. ${o.semester?.label ?? ''}`} actions={<Button size="sm" variant="secondary" onClick={() => setNewLevy(o)}>Set dues</Button>} />
          {o.levies.length === 0 ? <CardBody><EmptyState title="No dues set this semester" /></CardBody> : (
            <ul className="divide-y divide-border">
              {o.levies.map((l) => (
                <li key={l.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <span><span className="font-medium">{l.title}</span> {formatCedis(l.amount)} {!l.isOpen && <Badge>closed</Badge>}
                    <span className="block text-xs text-muted">{l.paidCount} of {o.members} paid. Online {formatCedis(l.online)} (paid to the association by Finance). Cash you hold {formatCedis(l.cash)}.</span></span>
                  <span className="flex gap-2">
                    <Button size="sm" onClick={() => setOpen(l.id)}>Members and cash</Button>
                    <Button size="sm" variant="ghost" onClick={() => feesApi.setLevyOpen(l.id, !l.isOpen).then(load).catch((err) => setError(errorMessage(err)))}>{l.isOpen ? 'Close' : 'Reopen'}</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      {error && <Alert tone="danger">{error}</Alert>}
      {newLevy && <LevyDialog office={newLevy} onClose={() => setNewLevy(null)} onDone={() => { setNewLevy(null); load(); }} />}
      {open && <MembersDialog levyId={open} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function LevyDialog({ office, onClose, onDone }: { office: Office; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: `${office.association.code} dues`, amount: '', dueOn: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await feesApi.createLevy(office.association.id, { title: f.title.trim(), amount: Math.round(Number(f.amount) * 100), dueOn: f.dueOn }); onDone(); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={`Set ${office.association.code} dues`} description={`For ${office.semester?.label ?? 'this semester'}. Members see it straight away and can pay online.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Title" htmlFor="lv-t"><Input id="lv-t" value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (GH₵)" htmlFor="lv-a"><Input id="lv-a" type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Due by" htmlFor="lv-d"><Input id="lv-d" type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={f.title.trim().length < 3 || !(Number(f.amount) >= 1) || !f.dueOn} onClick={save}>Set dues</Button></div>
      </div>
    </Dialog>
  );
}

function MembersDialog({ levyId, onClose }: { levyId: string; onClose: () => void }) {
  const [data, setData] = useState<LevyMembers | null>(null);
  const [index, setIndex] = useState('');
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { feesApi.levyMembers(levyId).then(setData).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, [levyId]);
  useEffect(() => { load(); }, [load]);
  const record = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await feesApi.recordCash(levyId, index.trim().toUpperCase());
      setMsg({ tone: 'success', text: `Receipt ${r.receiptNumber}: ${formatCedis(r.amount)} cash from ${r.student}. They have been sent the receipt by SMS.` });
      setIndex('');
      load();
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); } finally { setBusy(false); }
  };
  const shown = data?.members.filter((m) => !filter || `${m.indexNumber} ${m.firstName} ${m.lastName}`.toLowerCase().includes(filter.toLowerCase())) ?? [];
  return (
    <Dialog open onClose={onClose} title={data ? `${data.levy.association.code}: ${data.levy.title}` : 'Dues'} description={data ? `${formatCedis(data.levy.amount)} each. ${data.members.filter((m) => m.payment).length} of ${data.members.length} paid.` : undefined}>
      {!data ? <Spinner /> : (
        <div className="flex flex-col gap-4">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          {data.levy.isOpen && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (index.trim().length >= 8) void record(); }}>
              <Field label="Record cash: index number" htmlFor="cash-idx"><Input id="cash-idx" value={index} onChange={(e) => setIndex(e.target.value)} placeholder="Take the money, then record it here" /></Field>
              <Button type="submit" className="self-end" loading={busy} disabled={index.trim().length < 8}>Record {formatCedis(data.levy.amount)}</Button>
            </form>
          )}
          <div className="flex gap-2">
            <Input aria-label="Find a member" placeholder="Find by index number or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <Button variant="secondary" onClick={() => downloadCsv(`${data.levy.association.code}-dues.csv`, [['Index number', 'Name', 'Level', 'Paid', 'Receipt', 'How'], ...data.members.map((m) => [m.indexNumber, `${m.firstName} ${m.lastName}`, m.level, m.payment ? 'Yes' : 'No', m.payment?.receiptNumber, m.payment ? (m.payment.method === 'CASH' ? 'Cash' : 'Online') : ''])])}>CSV</Button>
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto text-sm">
            {shown.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>{m.firstName} {m.lastName} <span className="text-muted">{m.indexNumber}</span></span>
                {m.payment ? <Badge tone="success">{m.payment.receiptNumber}</Badge> : <Badge>not paid</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
