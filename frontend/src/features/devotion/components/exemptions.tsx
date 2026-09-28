'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';

/** Chaplaincy: students excused from morning devotion this semester (weekend students are exempt already). */
export function DevotionExemptions() {
  const [list, setList] = useState<Array<{ reason: string; createdAt: string; student: { id: string; firstName: string; lastName: string; indexNumber: string | null } }> | null>(null);
  const [f, setF] = useState({ indexNumber: '', reason: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get('/devotion/exemptions').then((r) => setList(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  if (!list) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="Exempt a student" description="For this semester. They are not expected at services, and their course marks out of 95 are scaled to 100, like weekend students." />
        <CardBody>
          <form className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); api.post('/devotion/exemptions', f).then(() => { setMsg({ tone: 'success', text: 'Exemption recorded.' }); setF({ indexNumber: '', reason: '' }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }}>
            <Field label="Index number" htmlFor="dx-i"><Input id="dx-i" value={f.indexNumber} onChange={(e) => setF({ ...f, indexNumber: e.target.value })} /></Field>
            <Field label="Reason" htmlFor="dx-r"><Input id="dx-r" value={f.reason} maxLength={300} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" disabled={f.indexNumber.trim().length < 6 || f.reason.trim().length < 5}>Exempt</Button></div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Exempt this semester" />
        {list.length === 0 ? <CardBody><EmptyState title="Nobody yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {list.map((e) => (
              <li key={e.student.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span>{e.student.firstName} {e.student.lastName} <span className="text-muted">{e.student.indexNumber}. {e.reason}. Since {formatDate(e.createdAt)}.</span></span>
                <Button variant="ghost" size="sm" onClick={() => api.delete(`/devotion/exemptions/${e.student.id}`).then(load)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
