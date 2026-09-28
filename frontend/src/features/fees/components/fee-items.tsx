'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { feesApi, type FeeItem } from '../api';

/** The Accounts office's list of fee names. Schedules, bills, statements and receipts all use these labels. */
export function FeeItems() {
  const [items, setItems] = useState<FeeItem[] | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { feesApi.items().then(setItems).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ tone: 'success', text: ok }); load(); } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  if (!items) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const current = items.find((i) => i.id === editing);
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title={current ? `Rename ${current.name}` : 'Add a fee item'} description={current ? 'Bills already issued keep the name they were issued with.' : 'For example Tuition, SRC dues, Examination fee, Hall affiliation.'} />
        <CardBody>
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) void run(async () => { await feesApi.saveItem({ name: name.trim(), description: desc.trim() || undefined }, editing ?? undefined); setName(''); setDesc(''); setEditing(null); }, 'Saved.'); }}>
            <Field label="Name" htmlFor="fi-name"><Input id="fi-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Description (optional)" htmlFor="fi-desc"><Input id="fi-desc" value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} /></Field>
            <div className="flex items-end gap-2"><Button type="submit" disabled={name.trim().length < 2}>{editing ? 'Save' : 'Add'}</Button>{editing && <Button variant="ghost" onClick={() => { setEditing(null); setName(''); setDesc(''); }}>Cancel</Button>}</div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Fee items" />
        {items.length === 0 ? <CardBody><EmptyState title="No fee items yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span><span className="font-medium">{i.name}</span> {!i.isActive && <Badge>not in use</Badge>}<span className="block text-xs text-muted">{i.description ?? ''} Used in {i._count.lines} schedule lines.</span></span>
                <span className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(i.id); setName(i.name); setDesc(i.description ?? ''); }}>Rename</Button>
                  <Button variant="ghost" size="sm" onClick={() => run(() => feesApi.saveItem({ name: i.name, description: i.description ?? undefined, isActive: !i.isActive }, i.id), i.isActive ? `${i.name} will no longer be offered for new schedules.` : `${i.name} is in use again.`)}>{i.isActive ? 'Stop using' : 'Use again'}</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
