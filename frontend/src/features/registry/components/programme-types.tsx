'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { renderIndexNumber, validateIndexFormat } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { feesApi } from '@/features/fees/api';
import { CATEGORY_LABEL, MODE_LABEL, registryApi, type Category, type Mode, type ProgrammeType } from '../api';

/** Programme types with their length and index number format, and the exam fee clearance rule. */
export function ProgrammeTypes() {
  const [types, setTypes] = useState<ProgrammeType[] | null>(null);
  const [editing, setEditing] = useState<ProgrammeType | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { registryApi.structure().then((d) => setTypes(d.types)).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => { load(); }, [load]);
  if (!types) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Programme types" description="Each programme belongs to a type. The type sets how many semesters it runs and the format of its students' index numbers." actions={<Button size="sm" onClick={() => setEditing('new')}>Add type</Button>} />
        <ul className="divide-y divide-border">
          {types.map((t) => (
            <li key={t.code} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span><span className="font-medium">{t.name}</span> <span className="text-muted">code {t.code}</span> {!t.isActive && <Badge>closed</Badge>}
                <span className="block text-xs text-muted">{CATEGORY_LABEL[t.category]}, {MODE_LABEL[t.mode].toLowerCase()}, {t.semesters} semesters. Index format <span className="font-mono">{t.indexFormat}</span>, for example <span className="font-mono">{t.example}</span>. {t._count.programmes} programmes.</span></span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Edit</Button>
            </li>
          ))}
        </ul>
      </Card>
      <DevotionRule />
      <ClearanceRule />
      {editing && <TypeDialog t={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function TypeDialog({ t, onClose, onDone }: { t: ProgrammeType | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: t?.code ?? '', name: t?.name ?? '', category: (t?.category ?? 'BACHELORS') as Category, mode: (t?.mode ?? 'REGULAR') as Mode, semesters: String(t?.semesters ?? 8), indexFormat: t?.indexFormat ?? 'ANU{YY}{CODE}{SEQ:5}', isActive: t?.isActive ?? true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const problems = useMemo(() => validateIndexFormat(f.indexFormat), [f.indexFormat]);
  const example = useMemo(() => { try { return renderIndexNumber(f.indexFormat, { year: new Date().getUTCFullYear(), code: f.code || 'X', sequence: 1, programmeCode: 'DCE' }); } catch { return null; } }, [f.indexFormat, f.code]);
  const save = async () => {
    setBusy(true);
    try { await registryApi.saveType({ ...f, semesters: Number(f.semesters) }, t?.code); onDone(); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={t ? `Edit ${t.name}` : 'Add programme type'} description={t && t._count.programmes ? 'A new index format applies to students registered from now on. Existing index numbers never change.' : undefined}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Code" htmlFor="pt-code" hint="Can appear in index numbers."><Input id="pt-code" value={f.code} disabled={!!t} maxLength={3} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <div className="sm:col-span-2"><Field label="Name" htmlFor="pt-name"><Input id="pt-name" value={f.name} maxLength={80} placeholder="Bachelor's degree (weekend)" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Kind" htmlFor="pt-cat"><Select id="pt-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>{(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select></Field>
          <Field label="Study mode" htmlFor="pt-mode"><Select id="pt-mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as Mode })}>{(Object.keys(MODE_LABEL) as Mode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</Select></Field>
          <Field label="Semesters" htmlFor="pt-sem"><Input id="pt-sem" type="number" min={1} max={24} value={f.semesters} onChange={(e) => setF({ ...f, semesters: e.target.value })} /></Field>
        </div>
        <Field label="Index number format" htmlFor="pt-fmt" hint="{YY} or {YYYY} admission year, {CODE} this type's code, {PROG} each programme's own index code (such as DCE), {SEQ:4} running number at the end. For example ANU{YY}{CODE}{SEQ:5}, ANUGS{YY}{SEQ:4} or {PROG}{YY}{SEQ:4}.">
          <Input id="pt-fmt" className="font-mono" value={f.indexFormat} maxLength={40} onChange={(e) => setF({ ...f, indexFormat: e.target.value.toUpperCase().replace(/\{SEQ:(\d)\}/g, '{SEQ:$1}') })} />
        </Field>
        {problems.length ? <Alert tone="warning">{problems[0]}</Alert> : <p className="text-sm">The first student this year would be <span className="font-mono font-semibold">{example}</span>{f.indexFormat.includes('{PROG}') ? ' (on a programme with index code DCE). Each programme then needs its own code, and gets its own sequence.' : '.'}</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Open for new programmes and students</label>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!f.code || f.name.trim().length < 3 || problems.length > 0 || !(Number(f.semesters) >= 1)} onClick={save}>Save</Button></div>
      </div>
    </Dialog>
  );
}

function ClearanceRule() {
  const [pct, setPct] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { feesApi.clearanceRule().then((r) => setPct(String(r.clearancePercent))).catch(() => undefined); }, []);
  if (pct === null) return null;
  const save = async () => {
    try {
      const r = await feesApi.saveClearanceRule(Number(pct));
      setMsg({ tone: 'success', text: r.rechecked ? `Saved. Clearance was rechecked for ${r.rechecked} students this semester.` : 'Saved.' });
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  return (
    <Card>
      <CardHeader title="Exam fee clearance" description="Students are cleared for exams automatically once they have paid this share of the semester's fees. Clearances the Finance Office sets by hand are not changed." />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="flex items-end gap-2">
          <Field label="Paid to be cleared (%)" htmlFor="cr-pct"><Input id="cr-pct" className="w-32" type="number" min={1} max={100} value={pct} onChange={(e) => { setPct(e.target.value); setMsg(null); }} /></Field>
          <Button variant="secondary" disabled={!(Number(pct) >= 1 && Number(pct) <= 100)} onClick={save}>Save</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function DevotionRule() {
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api.get<{ inTotals: boolean }>('/registry/devotion-rule').then((r) => setOn(r.data.inTotals)).catch(() => undefined); }, []);
  if (on === null) return null;
  return (
    <Card>
      <CardHeader title="Morning devotion in course totals" description="When on, lecturers set assessments that add up to 95%, and each student's devotion score (out of 5.00) is added to every course. Weekend students are exempt: their 95 is scaled to 100. Results cannot be submitted until the Chaplaincy has finalised devotion scores." />
      <CardBody className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={on} onChange={(e) => api.put('/registry/devotion-rule', { inTotals: e.target.checked }).then((r) => { setOn(r.data.inTotals); setMsg('Saved. It applies to results submitted from now on.'); }).catch((err) => setMsg(errorMessage(err)))} /> Devotion counts in course totals</label>
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </CardBody>
    </Card>
  );
}
