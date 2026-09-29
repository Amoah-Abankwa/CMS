'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';

interface Rules { notificationsDays: number; deliveriesDays: number; abandonedPaymentsDays: number; activityLogYears: number | null }

/** Records retention (Super Admin): how long records are kept before the nightly clean-up. */
export function RetentionSettings() {
  const [r, setR] = useState<{ notificationsDays: string; deliveriesDays: string; abandonedPaymentsDays: string; activityLogYears: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { api.get<Rules>('/security/retention').then(({ data: d }) => setR({ notificationsDays: String(d.notificationsDays), deliveriesDays: String(d.deliveriesDays), abandonedPaymentsDays: String(d.abandonedPaymentsDays), activityLogYears: d.activityLogYears ? String(d.activityLogYears) : '' })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  if (!r) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const save = () => api.put('/security/retention', { notificationsDays: Number(r.notificationsDays), deliveriesDays: Number(r.deliveriesDays), abandonedPaymentsDays: Number(r.abandonedPaymentsDays), activityLogYears: r.activityLogYears ? Number(r.activityLogYears) : null })
    .then(() => setMsg({ tone: 'success', text: 'Saved. The nightly clean-up uses these from tonight.' })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <Card>
      <CardHeader title="Records retention" description="How long records are kept before the nightly clean-up removes them. These are ANU decisions (for example under the Data Protection Act, 2012 (Act 843) and audit requirements); agree them before changing the defaults." />
      <CardBody className="flex flex-col gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Read notifications (days)" htmlFor="rt-n" hint="Unread ones are kept."><Input id="rt-n" type="number" min={30} max={3650} value={r.notificationsDays} onChange={(e) => setR({ ...r, notificationsDays: e.target.value })} /></Field>
          <Field label="Copies of sent emails and texts (days)" htmlFor="rt-d"><Input id="rt-d" type="number" min={30} max={3650} value={r.deliveriesDays} onChange={(e) => setR({ ...r, deliveriesDays: e.target.value })} /></Field>
          <Field label="Online payments never completed (days)" htmlFor="rt-p" hint="Completed payments are never removed."><Input id="rt-p" type="number" min={30} max={3650} value={r.abandonedPaymentsDays} onChange={(e) => setR({ ...r, abandonedPaymentsDays: e.target.value })} /></Field>
          <Field label="Activity log (years)" htmlFor="rt-a" hint="Empty keeps it for good (the default). At least one year."><Input id="rt-a" type="number" min={1} max={50} value={r.activityLogYears} placeholder="Keep for good" onChange={(e) => setR({ ...r, activityLogYears: e.target.value })} /></Field>
        </div>
        <div><Button onClick={save}>Save</Button></div>
      </CardBody>
    </Card>
  );
}
