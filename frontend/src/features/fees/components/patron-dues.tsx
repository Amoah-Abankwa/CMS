'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { feesApi, type Patronage } from '../api';

/** A Head of Department serving as an association's patron sets its dues each semester. */
export function PatronDues() {
  const [list, setList] = useState<Patronage[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { feesApi.patronages().then(setList).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  if (!list) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  if (!list.length) return <EmptyState title="You are not an association's patron" description="The Dean of Students office names a Head of Department as each association's patron." />;
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {list.map((a) => <Association key={a.id} a={a} onChange={(t) => { setMsg({ tone: 'success', text: t }); load(); }} onError={(t) => setMsg({ tone: 'danger', text: t })} />)}
    </div>
  );
}

function Association({ a, onChange, onError }: { a: Patronage; onChange: (t: string) => void; onError: (t: string) => void }) {
  const [f, setF] = useState({ title: '', amount: '', dueOn: '' });
  const create = () => feesApi.createLevy(a.id, { title: f.title.trim(), amount: Math.round(Number(f.amount) * 100), dueOn: f.dueOn })
    .then(() => { setF({ title: '', amount: '', dueOn: '' }); onChange(`Dues set for ${a.code}. The officers have been told and students can pay.`); })
    .catch((err) => onError(errorMessage(err)));
  return (
    <Card>
      <CardHeader title={`${a.code}: ${a.name}`} description={`${a.departments.join(', ')}. ${a.members} students. ${a.semester ?? ''}`} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm text-muted">Officers: {a.officers.length ? a.officers.map((o) => `${o.student.firstName} ${o.student.lastName} (${o.office.toLowerCase()}${o.student.phone ? `, ${o.student.phone}` : ''})`).join('; ') : 'none recorded yet'}. They collect cash and issue receipts.</p>
        {a.levies.length === 0 ? <p className="text-sm">No dues set this semester.</p> : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {a.levies.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span><span className="font-medium">{l.title}</span> {formatCedis(l.amount)}, due {formatDate(l.dueOn)} {!l.isOpen && <Badge>closed</Badge>}<span className="block text-xs text-muted">{l.paidCount} of {a.members} paid: {formatCedis(l.online)} online, {formatCedis(l.cash)} cash.</span></span>
                <Button size="sm" variant="ghost" onClick={() => feesApi.setLevyOpen(l.id, !l.isOpen).then(() => onChange(l.isOpen ? 'Collection closed.' : 'Collection reopened.')).catch((err) => onError(errorMessage(err)))}>{l.isOpen ? 'Close collection' : 'Reopen'}</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Dues" htmlFor={`pd-t-${a.id}`}><Input id={`pd-t-${a.id}`} value={f.title} maxLength={80} placeholder="Semester dues" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Amount (GH₵)" htmlFor={`pd-a-${a.id}`}><Input id={`pd-a-${a.id}`} type="number" min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Due by" htmlFor={`pd-d-${a.id}`}><Input id={`pd-d-${a.id}`} type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></Field>
          <Button disabled={f.title.trim().length < 3 || !(Number(f.amount) > 0) || !f.dueOn} onClick={create}>Set dues</Button>
        </div>
      </CardBody>
    </Card>
  );
}
