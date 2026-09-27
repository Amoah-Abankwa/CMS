'use client';

import { useEffect, useMemo, useState } from 'react';
import { checkEligibility, formatCedis, type EmploymentRules as Rules } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { workApi } from '../api';

/** Who may work, and how dispatchers are paid, with examples that follow the settings. */
export function EmploymentRules() {
  const [r, setR] = useState<Record<keyof Rules, string> | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    workApi.rules().then((x) => setR({
      minCgpa: x.minCgpa.toFixed(2), allowNoResults: String(x.allowNoResults), maxJobs: String(x.maxJobs), dispatchFee: String(x.dispatchFee / 100),
      maxActiveDeliveries: String(x.maxActiveDeliveries), dispatchWaitMinutes: String(x.dispatchWaitMinutes),
    })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  }, []);

  const rules: Rules | null = useMemo(() => r && ({
    minCgpa: Number(r.minCgpa), allowNoResults: r.allowNoResults === 'true', maxJobs: Number(r.maxJobs), dispatchFee: Math.round(Number(r.dispatchFee) * 100),
    maxActiveDeliveries: Number(r.maxActiveDeliveries), dispatchWaitMinutes: Number(r.dispatchWaitMinutes),
  }), [r]);

  if (!r || !rules) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const set = (k: keyof Rules, v: string) => { setR({ ...r, [k]: v }); setMsg(null); };
  const save = async () => {
    setBusy(true);
    try {
      await workApi.saveRules(rules);
      setMsg({ tone: 'success', text: 'Saved. Eligibility everywhere now follows these rules.' });
    } catch (err) {
      setMsg({ tone: 'danger', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const example = (cgpa: number | null) => {
    const e = checkEligibility({ cgpa, registered: true, holds: [] }, rules);
    return e.eligible ? 'can apply' : 'cannot apply';
  };

  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="Who may work" description="Applies to campus jobs and to dispatching. Students also need an approved course registration this semester, and no disciplinary or academic misconduct hold." />
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum CGPA" htmlFor="er-cgpa" hint="0.00 to 4.00. A job can ask for more."><Input id="er-cgpa" type="number" step="0.01" min={0} max={4} value={r.minCgpa} onChange={(e) => set('minCgpa', e.target.value)} /></Field>
            <Field label="Campus jobs a student may hold at once" htmlFor="er-jobs" hint="Dispatching does not count."><Input id="er-jobs" type="number" min={1} max={3} value={r.maxJobs} onChange={(e) => set('maxJobs', e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={r.allowNoResults === 'true'} onChange={(e) => set('allowNoResults', String(e.target.checked))} /> Students with no published results yet (usually first-years) may apply</label>
          <p className="rounded-md bg-surface-muted px-3 py-2 text-sm">
            With these rules, a student with a CGPA of 3.20 {example(3.2)}; 2.40 {example(2.4)}; no results yet {example(null)}.
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Campus dispatchers" description="Dispatchers are paid per delivery. The fee comes out of the vendor's settlement and Finance pays the student by mobile money." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Paid per delivery (GH₵)" htmlFor="er-fee" hint="1.00 to 50.00."><Input id="er-fee" type="number" step="0.5" value={r.dispatchFee} onChange={(e) => set('dispatchFee', e.target.value)} /></Field>
          <Field label="Deliveries carried at once" htmlFor="er-max"><Input id="er-max" type="number" min={1} max={5} value={r.maxActiveDeliveries} onChange={(e) => set('maxActiveDeliveries', e.target.value)} /></Field>
          <Field label="Alert the vendor after (minutes)" htmlFor="er-wait" hint="If nobody takes an order."><Input id="er-wait" type="number" min={5} max={60} value={r.dispatchWaitMinutes} onChange={(e) => set('dispatchWaitMinutes', e.target.value)} /></Field>
          <p className="text-sm text-muted sm:col-span-3">Example: 10 deliveries in a week earn a dispatcher {formatCedis(rules.dispatchFee * 10)}.</p>
        </CardBody>
      </Card>
      <div><Button loading={busy} onClick={save}>Save rules</Button></div>
    </div>
  );
}
