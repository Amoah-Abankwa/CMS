'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis, type FeeRules } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { feesApi, type FeeOptions, type Schedule } from '../api';

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
                <span className="text-sm"><span className="font-medium">{s.name}</span> <span className="tabular-nums">{formatCedis(s.lines.reduce((t, l) => t + l.amount, 0))}</span>
                  <span className="block text-xs text-muted">For {s.programme?.name ?? 'every programme'}, {s.level ? `level ${s.level}` : 'every level'}. {s.lines.map((l) => l.name).join(', ')}. {s._count.bills} bills issued.</span></span>
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
  const [r, setR] = useState<{ clearancePercent: string; minOnlinePayment: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { feesApi.rules().then((x: FeeRules) => setR({ clearancePercent: String(x.clearancePercent), minOnlinePayment: String(x.minOnlinePayment / 100) })).catch(() => undefined); }, []);
  if (!r) return null;
  const save = async () => {
    try {
      const x = await feesApi.saveRules({ clearancePercent: Number(r.clearancePercent), minOnlinePayment: Math.round(Number(r.minOnlinePayment) * 100) });
      setMsg({ tone: 'success', text: x.rechecked ? `Saved. Clearance was rechecked for ${x.rechecked} bills this semester.` : 'Saved.' });
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  return (
    <Card>
      <CardHeader title="Clearance rule" description="Students are cleared for exams automatically once they have paid this share of the semester's bill. A clearance you set by hand on the Fee clearance screen is never changed by this rule." />
      <CardBody className="flex flex-col gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid to be cleared (%)" htmlFor="fr-pct"><Input id="fr-pct" type="number" min={1} max={100} value={r.clearancePercent} onChange={(e) => setR({ ...r, clearancePercent: e.target.value })} /></Field>
          <Field label="Smallest online payment (GH₵)" htmlFor="fr-min"><Input id="fr-min" type="number" value={r.minOnlinePayment} onChange={(e) => setR({ ...r, minOnlinePayment: e.target.value })} /></Field>
        </div>
        <div><Button variant="secondary" onClick={save}>Save rule</Button></div>
      </CardBody>
    </Card>
  );
}

function ScheduleDialog({ target, semesterId, programmes, onClose, onDone }: { target: Schedule | 'new' | null; semesterId: string; programmes: FeeOptions['programmes']; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', programmeId: '', level: '' });
  const [lines, setLines] = useState<Array<{ name: string; amount: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!target) return;
    const s = target === 'new' ? null : target;
    setF({ name: s?.name ?? '', programmeId: s?.programmeId ?? '', level: s?.level ? String(s.level) : '' });
    setLines(s ? s.lines.map((l) => ({ name: l.name, amount: String(l.amount / 100) })) : [{ name: 'Tuition', amount: '' }, { name: 'SRC dues', amount: '' }]);
    setError(null);
  }, [target]);
  if (!target) return null;
  const existing = target === 'new' ? null : target;
  const total = lines.reduce((t, l) => t + Math.round(Number(l.amount || 0) * 100), 0);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await feesApi.saveSchedule({ semesterId, name: f.name.trim(), programmeId: f.programmeId || null, level: f.level ? Number(f.level) : null, lines: lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), amount: Math.round(Number(l.amount || 0) * 100) })) }, existing?.id);
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
          <Field label="Level" htmlFor="sc-level"><Select id="sc-level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">Every level</option>{[100, 200, 300, 400, 500, 600].map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Items</legend>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Item ${i + 1}`} value={l.name} maxLength={60} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input aria-label={`Amount for item ${i + 1} (GH₵)`} className="w-36" type="number" inputMode="decimal" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <div className="flex items-center justify-between"><Button variant="ghost" size="sm" onClick={() => setLines([...lines, { name: '', amount: '' }])}>Add item</Button><span className="text-sm font-medium tabular-nums">Total {formatCedis(total)}</span></div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={f.name.trim().length < 3 || !lines.some((l) => l.name.trim()) || total <= 0} onClick={save}>Save schedule</Button>
        </div>
      </div>
    </Dialog>
  );
}
