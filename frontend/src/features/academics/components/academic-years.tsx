'use client';

import { SUMMER_KIND_LABEL, termDates, termName } from '@anu/shared';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { academicsApi, type AcademicYearRow } from '../api';

/**
 * The Registrar's academic calendar: academic years and their semesters. Registration dates, credit
 * limits and which semester is current are then set on each semester in the list below.
 */
export function AcademicYears({ onChanged }: { onChanged: () => void }) {
  const [years, setYears] = useState<AcademicYearRow[] | null>(null);
  const [f, setF] = useState({ label: '', startDate: '', endDate: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { academicsApi.years().then(setYears).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  const done = (text: string) => { setMsg({ tone: 'success', text }); load(); onChanged(); };
  const fail = (err: unknown) => setMsg({ tone: 'danger', text: errorMessage(err) });
  const suggest = (label: string) => {
    const m = /^(\d{4})\/(\d{4})$/.exec(label.trim());
    return m ? { startDate: `${m[1]}-09-01`, endDate: `${m[2]}-08-31` } : {};
  };
  if (!years) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  return (
    <Card>
      <CardHeader title="Academic years" description="Each academic year has Fall (September to December), Spring (January to May) and Summer (June to August); for each summer, choose promotional or upgrade. Create each year and its terms. Then, in the list below, set each semester's registration dates and credit limits, and mark the one that is current." />
      <CardBody className="flex flex-col gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="New academic year" htmlFor="ay-l"><Input id="ay-l" value={f.label} placeholder="2026/2027" maxLength={9} onChange={(e) => setF({ ...f, label: e.target.value, ...(!f.startDate && !f.endDate ? suggest(e.target.value) : {}) })} /></Field>
          <Field label="Starts" htmlFor="ay-s"><Input id="ay-s" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label="Ends" htmlFor="ay-e"><Input id="ay-e" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          <Button disabled={!f.label.trim() || !f.startDate || !f.endDate} onClick={() => academicsApi.createYear({ label: f.label.trim(), startDate: f.startDate, endDate: f.endDate }).then(() => { setF({ label: '', startDate: '', endDate: '' }); done(`${f.label.trim()} created. Now add its semesters.`); }).catch(fail)}>Create year</Button>
        </div>
        {years.length === 0 ? <EmptyState title="No academic years yet" description="Create the current academic year first." /> : (
          <ul className="flex flex-col gap-3">
            {years.map((y) => <YearRow key={y.id} y={y} onDone={done} onFail={fail} />)}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function YearRow({ y, onDone, onFail }: { y: AcademicYearRow; onDone: (t: string) => void; onFail: (e: unknown) => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const next = [1, 2, 3].find((n) => !y.semesters.some((s) => s.number === n)) ?? 1;
  const startYear = Number(y.label.slice(0, 4));
  const blank = (n: number) => ({ number: String(n), ...termDates(startYear, n) });
  const [s, setS] = useState(blank(next));
  const [dates, setDates] = useState({ startDate: y.startDate.slice(0, 10), endDate: y.endDate.slice(0, 10) });
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span><span className="font-semibold">{y.label}</span> <span className="text-muted">{formatDate(y.startDate)} to {formatDate(y.endDate)}</span> {y.isCurrent && <Badge tone="primary">Current year</Badge>}</span>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setAdding(!adding); setS(blank(next)); }}>Add term</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>Change dates</Button>
          {y.semesters.length === 0 && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Delete ${y.label}?`)) academicsApi.deleteYear(y.id).then(() => onDone(`${y.label} deleted.`)).catch(onFail); }}>Delete</Button>}
        </span>
      </div>
      {editing && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Starts" htmlFor={`ye-s-${y.id}`}><Input id={`ye-s-${y.id}`} type="date" value={dates.startDate} onChange={(e) => setDates({ ...dates, startDate: e.target.value })} /></Field>
          <Field label="Ends" htmlFor={`ye-e-${y.id}`}><Input id={`ye-e-${y.id}`} type="date" value={dates.endDate} onChange={(e) => setDates({ ...dates, endDate: e.target.value })} /></Field>
          <Button size="sm" onClick={() => academicsApi.updateYear(y.id, dates).then(() => { setEditing(false); onDone(`${y.label} dates saved.`); }).catch(onFail)}>Save</Button>
        </div>
      )}
      {y.semesters.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {y.semesters.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">{termName(m.number)}: {formatDate(m.startDate)} to {formatDate(m.endDate)} {m.isCurrent && <Badge tone="primary">Current</Badge>}
                {m.number === 3 && (
                  <Select aria-label="Summer type" className="h-8 w-52" value={m.summerKind ?? ''} onChange={(e) => academicsApi.setSummerKind(m.id, e.target.value as 'PROMOTIONAL').then(() => onDone(`${y.label} Summer is now ${SUMMER_KIND_LABEL[e.target.value as 'PROMOTIONAL'].toLowerCase()}.`)).catch(onFail)}>
                    <option value="" disabled>Choose summer type</option>
                    <option value="PROMOTIONAL">Promotional (failed or not yet taken)</option>
                    <option value="UPGRADE">Upgrade (any course, to improve)</option>
                  </Select>
                )}
              </span>
              {!m.isCurrent && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Delete ${y.label}, ${termName(m.number)}? Only possible if nothing uses it yet.`)) academicsApi.deleteSemester(m.id).then(() => onDone('Semester deleted.')).catch(onFail); }}>Delete</Button>}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
          <Field label="Term" htmlFor={`sn-${y.id}`}><Select id={`sn-${y.id}`} value={s.number} onChange={(e) => setS(blank(Number(e.target.value)))}>{[1, 2, 3].map((n) => <option key={n} value={n} disabled={y.semesters.some((x) => x.number === n)}>{termName(n)}</option>)}</Select></Field>
          <Field label="Starts" htmlFor={`ss-${y.id}`}><Input id={`ss-${y.id}`} type="date" min={y.startDate.slice(0, 10)} max={y.endDate.slice(0, 10)} value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} /></Field>
          <Field label="Ends" htmlFor={`se-${y.id}`}><Input id={`se-${y.id}`} type="date" min={y.startDate.slice(0, 10)} max={y.endDate.slice(0, 10)} value={s.endDate} onChange={(e) => setS({ ...s, endDate: e.target.value })} /></Field>
          <Button size="sm" disabled={!s.startDate || !s.endDate} onClick={() => academicsApi.createSemester(y.id, { number: Number(s.number), startDate: s.startDate, endDate: s.endDate }).then(() => { setAdding(false); onDone(`${y.label}, ${termName(s.number)} added. Set its registration dates below, and make it current when it starts.`); }).catch(onFail)}>Add</Button>
        </div>
      )}
    </li>
  );
}
