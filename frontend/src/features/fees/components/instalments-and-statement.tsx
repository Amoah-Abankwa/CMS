'use client';

import { useEffect, useState } from 'react';
import { formatMoney, parseCsv } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/axios';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { academicsApi, type Semester } from '@/features/academics/api';
import { feesApi } from '../api';

/** Finance: the semester's instalment plan (dates and the share of the bill due by each). */
export function InstalmentPlan() {
  const [semesterId, setSemesterId] = useState('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  useEffect(() => { academicsApi.semesters().then((x) => { setSemesters(x); setSemesterId((x.find((s) => s.isCurrent) ?? x[0])?.id ?? ''); }).catch(() => undefined); }, []);
  const [rows, setRows] = useState<Array<{ dueDate: string; cumulativePercent: string }>>([]);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { if (semesterId) feesApi.instalments(semesterId).then((p) => setRows(p.instalments.map((i) => ({ dueDate: i.dueDate, cumulativePercent: String(i.cumulativePercent) })))).catch(() => setRows([])); }, [semesterId]);
  const save = () => feesApi.saveInstalments(semesterId, rows.map((r) => ({ dueDate: r.dueDate, cumulativePercent: Number(r.cumulativePercent) }))).then(() => setMsg({ tone: 'success', text: rows.length ? 'Plan saved. Students see what is due and when.' : 'Plan removed.' })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <Card>
      <CardHeader title="Instalments" description="By each date, at least this share of the bill must be paid, ending at 100%. For example 50% by the start of term, 75% mid-term, 100% before exams." />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <SemesterSelect semesters={semesters} value={semesterId} onChange={setSemesterId} id="ip-sem" />
        {semesterId && (
          <>
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[12rem_10rem_auto]">
                <Input aria-label="Date" type="date" value={r.dueDate} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
                <Input aria-label="Share paid by then (%)" type="number" min={1} max={100} value={r.cumulativePercent} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, cumulativePercent: e.target.value } : x)))} />
                <Button variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setRows([...rows, { dueDate: '', cumulativePercent: rows.length ? '100' : '50' }])}>Add instalment</Button><Button size="sm" onClick={save}>Save plan</Button></div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

type Line = { line: number; date: string; amount: number; reference: string; narration: string; bill: { id: string; student: { indexNumber: string; firstName: string; lastName: string } } | null; problem: string | null };

/** Finance: record bank deposits from the bank's statement, matched by index numbers in the narration. */
export function BankStatementImport() {
  const [currency, setCurrency] = useState<'GHS' | 'USD'>('GHS');
  const [cols, setCols] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState({ date: -1, amount: -1, reference: -1, narration: -1 });
  const [lines, setLines] = useState<Line[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null);
  const guess = (h: string[], words: string[]) => h.findIndex((x) => words.some((w) => x.toLowerCase().includes(w)));
  const read = async (f: File) => {
    setLines(null); setMsg(null);
    const rows = parseCsv(await f.text());
    if (rows.length < 2) { setMsg({ tone: 'danger', text: 'The file has no rows.' }); return; }
    setCols({ headers: rows[0], rows: rows.slice(1) });
    setMap({ date: guess(rows[0], ['date']), amount: guess(rows[0], ['credit', 'amount', 'deposit']), reference: guess(rows[0], ['ref', 'transaction', 'id']), narration: guess(rows[0], ['narration', 'description', 'details', 'remark']) });
  };
  const toDate = (v: string) => { const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v.trim()); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v.trim().slice(0, 10); };
  const match = async () => {
    if (!cols) return;
    const rows = cols.rows.map((r) => ({ date: toDate(r[map.date] ?? ''), amount: Math.round(Number(String(r[map.amount] ?? '').replace(/[^0-9.]/g, '')) * 100), reference: (r[map.reference] ?? '').trim(), narration: (r[map.narration] ?? '').trim() })).filter((r) => r.amount > 0 && r.reference.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    try {
      const out = (await api.post<Line[]>('/fees/bank-statement/match', { currency, rows })).data;
      setLines(out);
      setChosen(new Set(out.filter((l) => l.bill).map((l) => l.line)));
      if (rows.length < cols.rows.length) setMsg({ tone: 'warning', text: `${cols.rows.length - rows.length} lines were skipped (no amount, reference or date, or a withdrawal).` });
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  const apply = async () => {
    if (!lines) return;
    const items = lines.filter((l) => l.bill && chosen.has(l.line)).map((l) => ({ billId: l.bill!.id, amount: l.amount, reference: l.reference, paidOn: l.date }));
    try {
      const out = (await api.post<Array<{ reference: string; ok: boolean; message?: string }>>('/fees/bank-statement/apply', { currency, items })).data;
      const bad = out.filter((o) => !o.ok);
      setMsg({ tone: bad.length ? 'warning' : 'success', text: `${out.length - bad.length} payments recorded, each with a receipt.${bad.length ? ` Not recorded: ${bad.map((b) => `${b.reference} (${b.message})`).join('; ')}` : ''}` });
      setLines(null); setCols(null);
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  return (
    <Card>
      <CardHeader title="Import a bank statement" description="Save the bank's statement as CSV. Deposits whose narration contains a student's index number are matched to that student's bill this semester; you tick which to record. A bank reference is never recorded twice." />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Statement currency" htmlFor="bs-c"><Select id="bs-c" value={currency} onChange={(e) => setCurrency(e.target.value as 'GHS')}><option value="GHS">Cedis</option><option value="USD">US dollars</option></Select></Field>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted">Choose CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} /></label>
        </div>
        {cols && (
          <div className="grid gap-3 sm:grid-cols-4">
            {(['date', 'amount', 'reference', 'narration'] as const).map((k) => (
              <Field key={k} label={{ date: 'Date', amount: 'Amount (credit)', reference: 'Bank reference', narration: 'Narration' }[k]} htmlFor={`bs-${k}`}>
                <Select id={`bs-${k}`} value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}><option value={-1}>Choose</option>{cols.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</Select>
              </Field>
            ))}
            <div className="sm:col-span-4"><Button disabled={Object.values(map).some((v) => v < 0)} onClick={match}>Match to bills</Button></div>
          </div>
        )}
        {lines && (
          <>
            <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {lines.map((l) => (
                <li key={l.line} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" className="size-4" aria-label={`Record ${l.reference}`} disabled={!l.bill} checked={chosen.has(l.line)} onChange={(e) => { const n = new Set(chosen); if (e.target.checked) n.add(l.line); else n.delete(l.line); setChosen(n); }} />
                  <span className="flex-1">{l.date}, {formatMoney(l.amount, currency)}, {l.reference}<span className="block text-xs text-muted">{l.narration}</span></span>
                  <span className="text-xs">{l.bill ? `${l.bill.student.firstName} ${l.bill.student.lastName} (${l.bill.student.indexNumber})` : <span className="text-warning">{l.problem}</span>}</span>
                </li>
              ))}
            </ul>
            <div><Button disabled={!chosen.size} onClick={apply}>Record {chosen.size} payments</Button></div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
