'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoney, STUDENT_GROUP_LABEL, type Currency, type FeeRules, type FeeStudentGroup } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { InstalmentPlan } from './instalments-and-statement';
import { feesApi, type FeeItem, type FeeOptions, type Schedule } from '../api';

/** Fee schedules for a semester, issuing bills, and the clearance rule. */
export function FeeSetup() {
  const [opts, setOpts] = useState<FeeOptions | null>(null);
  const [semesterId, setSemesterId] = useState('');
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { feesApi.options().then((o) => { setOpts(o); setSemesterId(o.semesters.find((s) => s.isCurrent)?.id ?? o.semesters[0]?.id ?? ''); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  const load = useCallback(() => { if (semesterId) { setSchedules(null); feesApi.schedules(semesterId).then(setSchedules).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); } }, [semesterId]);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMsg(null);
    try { setMsg({ tone: 'success', text: await fn() }); load(); } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); } finally { setBusy(null); }
  };
  if (!opts) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const idx = opts.semesters.findIndex((s) => s.id === semesterId);
  const previous = opts.semesters[idx + 1];

  return (
    <div className="flex flex-col gap-4">
      <InstalmentPlan />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="Fee schedules" description="What students are charged each semester. Each student gets the most specific schedule that fits them: programme and level, then programme, then level, then everyone."
          actions={<Select aria-label="Semester" className="w-60" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>{opts.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}{s.isCurrent ? ' (current)' : ''}</option>)}</Select>} />
        {!schedules ? <CardBody><Spinner /></CardBody> : schedules.length === 0 ? (
          <CardBody><EmptyState title="No schedules for this semester" description={previous ? `Copy last semester's, or add one.` : 'Add the first one.'} /></CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {schedules.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="text-sm"><span className="font-medium">{s.name}</span> <span className="tabular-nums">{formatMoney(s.lines.reduce((t, l) => t + l.amount, 0), s.currency)}</span>
                  <span className="block text-xs text-muted">For {STUDENT_GROUP_LABEL[s.studentGroup].toLowerCase()}, {s.programme?.name ?? 'every programme'}, {s.level ? `level ${s.level}` : 'every level'}. {s.lines.map((l) => l.name).join(', ')}. {s._count.bills} bills issued.</span></span>
                <span className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>Edit</Button>
                  {s._count.bills === 0 && <Button variant="ghost" size="sm" onClick={() => run('del' + s.id, async () => { await feesApi.deleteSchedule(s.id); return 'Schedule removed.'; })}>Remove</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <CardBody className="flex flex-wrap gap-2 border-t border-border">
          <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>Add a schedule</Button>
          {previous && <Button size="sm" variant="ghost" loading={busy === 'copy'} onClick={() => run('copy', async () => { const r = await feesApi.copySchedules(previous.id, semesterId); return `Copied ${r.copied} schedules from ${previous.label}${r.skipped ? `; ${r.skipped} skipped because one already exists` : ''}. Check the amounts before issuing bills.`; })}>Copy from {previous.label}</Button>}
          {schedules && schedules.length > 0 && <Button size="sm" loading={busy === 'issue'} onClick={() => run('issue', async () => { const r = await feesApi.issue(semesterId); return `Issued ${r.issued} bills. ${r.alreadyBilled} students already had one.${r.noSchedule ? ` ${r.noSchedule} students fit no schedule; add one for them and issue again.` : ''} Students are told by email, SMS and in-app.`; })}>Issue bills</Button>}
        </CardBody>
      </Card>
      <RulesCard />
      <ScheduleDialog target={editing} semesterId={semesterId} programmes={opts.programmes} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />
    </div>
  );
}

function RulesCard() {
  const [r, setR] = useState<{ clearancePercent: number; minOnlinePayment: string; minOnlinePaymentUsd: string; lateFeeEnabled: boolean; lateFee: string; lateFeeUsd: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { feesApi.rules().then((x: FeeRules) => setR({ clearancePercent: x.clearancePercent, minOnlinePayment: String(x.minOnlinePayment / 100), minOnlinePaymentUsd: String(x.minOnlinePaymentUsd / 100), lateFeeEnabled: x.lateFeeEnabled, lateFee: String(x.lateFee / 100), lateFeeUsd: String(x.lateFeeUsd / 100) })).catch(() => undefined); }, []);
  if (!r) return null;
  const save = async () => {
    try {
      await feesApi.saveRules({ minOnlinePayment: Math.round(Number(r.minOnlinePayment) * 100), minOnlinePaymentUsd: Math.round(Number(r.minOnlinePaymentUsd) * 100), lateFeeEnabled: r.lateFeeEnabled, lateFee: Math.round(Number(r.lateFee) * 100), lateFeeUsd: Math.round(Number(r.lateFeeUsd) * 100) });
      setMsg({ tone: 'success', text: 'Saved.' });
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  return (
    <Card>
      <CardHeader title="Online payments" description={`Students are cleared for exams automatically once they have paid ${r.clearancePercent}% of the semester's bill. The Registrar's office sets that percentage.`} />
      <CardBody className="flex flex-col gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Smallest online payment (GH₵)" htmlFor="fr-min"><Input id="fr-min" type="number" value={r.minOnlinePayment} onChange={(e) => setR({ ...r, minOnlinePayment: e.target.value })} /></Field>
          <Field label="Smallest online payment (US$)" htmlFor="fr-usd"><Input id="fr-usd" type="number" value={r.minOnlinePaymentUsd} onChange={(e) => setR({ ...r, minOnlinePaymentUsd: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={r.lateFeeEnabled} onChange={(e) => setR({ ...r, lateFeeEnabled: e.target.checked })} /> Charge for late payment (off by default)</label>
        {r.lateFeeEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Charge per missed instalment (GH₵)" htmlFor="fr-lf"><Input id="fr-lf" type="number" value={r.lateFee} onChange={(e) => setR({ ...r, lateFee: e.target.value })} /></Field>
            <Field label="On dollar bills (US$)" htmlFor="fr-lfu"><Input id="fr-lfu" type="number" value={r.lateFeeUsd} onChange={(e) => setR({ ...r, lateFeeUsd: e.target.value })} /></Field>
          </div>
        )}
        {r.lateFeeEnabled && <p className="text-xs text-muted">Each morning, a bill that has not reached an instalment's share by its date gets this charge once for that instalment. It shows on the student's statement and can be waived like any charge.</p>}
        <div><Button variant="secondary" onClick={save}>Save</Button></div>
      </CardBody>
    </Card>
  );
}

function ScheduleDialog({ target, semesterId, programmes, onClose, onDone }: { target: Schedule | 'new' | null; semesterId: string; programmes: FeeOptions['programmes']; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', programmeId: '', level: '', studentGroup: 'ALL' as FeeStudentGroup, currency: 'GHS' as Currency });
  const [lines, setLines] = useState<Array<{ feeItemId: string; amount: string }>>([]);
  const [items, setItems] = useState<FeeItem[]>([]);
  useEffect(() => { feesApi.items().then((x) => setItems(x.filter((i) => i.isActive))).catch(() => undefined); }, []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!target) return;
    const s = target === 'new' ? null : target;
    setF({ name: s?.name ?? '', programmeId: s?.programmeId ?? '', level: s?.level ? String(s.level) : '', studentGroup: s?.studentGroup ?? 'ALL', currency: s?.currency ?? 'GHS' });
    setLines(s ? s.lines.map((l) => ({ feeItemId: l.feeItemId ?? '', amount: String(l.amount / 100) })) : [{ feeItemId: '', amount: '' }]);
    setError(null);
  }, [target]);
  if (!target) return null;
  const existing = target === 'new' ? null : target;
  const total = lines.reduce((t, l) => t + Math.round(Number(l.amount || 0) * 100), 0);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await feesApi.saveSchedule({ semesterId, name: f.name.trim(), programmeId: f.programmeId || null, level: f.level ? Number(f.level) : null, studentGroup: f.studentGroup, currency: f.currency, lines: lines.filter((l) => l.feeItemId).map((l) => ({ feeItemId: l.feeItemId, amount: Math.round(Number(l.amount || 0) * 100) })) }, existing?.id);
      onDone();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={existing ? `Edit ${existing.name}` : 'Add a fee schedule'} description={existing && existing._count.bills ? 'Bills already issued keep their amounts; changes apply to bills issued from now on.' : undefined}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Name" htmlFor="sc-name"><Input id="sc-name" value={f.name} maxLength={80} placeholder="Undergraduate, Ghanaian students" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Programme" htmlFor="sc-prog"><Select id="sc-prog" value={f.programmeId} onChange={(e) => setF({ ...f, programmeId: e.target.value })}><option value="">Every programme</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Students" htmlFor="sc-group"><Select id="sc-group" value={f.studentGroup} onChange={(e) => setF({ ...f, studentGroup: e.target.value as FeeStudentGroup, currency: e.target.value === 'INTERNATIONAL' ? 'USD' : f.currency })}>{(Object.keys(STUDENT_GROUP_LABEL) as FeeStudentGroup[]).map((g) => <option key={g} value={g}>{STUDENT_GROUP_LABEL[g]}</option>)}</Select></Field>
          <Field label="Currency" htmlFor="sc-cur"><Select id="sc-cur" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency })}><option value="GHS">Ghana cedis (GH₵)</option><option value="USD">US dollars (US$)</option></Select></Field>
          <Field label="Level" htmlFor="sc-level"><Select id="sc-level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">Every level</option>{[100, 200, 300, 400, 500, 600].map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Items</legend>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Select aria-label={`Item ${i + 1}`} value={l.feeItemId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, feeItemId: e.target.value } : x)))}>
                <option value="">Choose a fee item</option>
                {items.map((it) => <option key={it.id} value={it.id} disabled={lines.some((x, j) => j !== i && x.feeItemId === it.id)}>{it.name}</option>)}
              </Select>
              <Input aria-label={`Amount for item ${i + 1}`} className="w-36" type="number" inputMode="decimal" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <div className="flex items-center justify-between"><span className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setLines([...lines, { feeItemId: '', amount: '' }])}>Add item</Button><Link href="/finance/fees/items" className="self-center text-xs text-primary hover:underline">Edit the fee items list</Link></span><span className="text-sm font-medium tabular-nums">Total {formatMoney(total, f.currency)}</span></div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={f.name.trim().length < 3 || !lines.some((l) => l.feeItemId) || lines.some((l) => !l.feeItemId && l.amount) || total <= 0} onClick={save}>Save schedule</Button>
        </div>
      </div>
    </Dialog>
  );
}
