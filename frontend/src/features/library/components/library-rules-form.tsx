'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCedis, validateLibraryPolicy, WEEKDAY_NAMES, type LibraryPolicy } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { libraryApi } from '../api';

const cedis = (p: number) => String(p / 100);
const pesewas = (c: string) => Math.round(Number(c) * 100);

export function LibraryRulesForm() {
  const [p, setP] = useState<LibraryPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { libraryApi.policy().then(setP).catch((err) => setError(errorMessage(err))); }, []);
  const problems = useMemo(() => (p ? validateLibraryPolicy(p) : []), [p]);
  if (!p) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const set = (patch: Partial<LibraryPolicy>) => { setP({ ...p, ...patch }); setSaved(false); };
  const num = (v: string) => Number(v);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      setP(await libraryApi.setPolicy(p));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Rules saved. They apply to loans and fines from now on.</Alert>}
      {(['student', 'staff'] as const).map((who) => (
        <fieldset key={who} className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">{who === 'student' ? 'Students' : 'Staff'}</legend>
          <Field label="Loan length (days)" htmlFor={`${who}-days`}><Input id={`${who}-days`} type="number" inputMode="numeric" value={p[who].loanDays} onChange={(e) => set({ [who]: { ...p[who], loanDays: num(e.target.value) } })} /></Field>
          <Field label="Books at a time" htmlFor={`${who}-max`}><Input id={`${who}-max`} type="number" inputMode="numeric" value={p[who].maxItems} onChange={(e) => set({ [who]: { ...p[who], maxItems: num(e.target.value) } })} /></Field>
          <Field label="Renewals" htmlFor={`${who}-ren`}><Input id={`${who}-ren`} type="number" inputMode="numeric" value={p[who].maxRenewals} onChange={(e) => set({ [who]: { ...p[who], maxRenewals: num(e.target.value) } })} /></Field>
        </fieldset>
      ))}
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Fines</legend>
        <Field label="Per day late (GH₵)" htmlFor="f-day" hint="0 turns fines off."><Input id="f-day" type="number" inputMode="decimal" step="0.5" value={cedis(p.finePerDay)} onChange={(e) => set({ finePerDay: pesewas(e.target.value) })} /></Field>
        <Field label="Days before fines start" htmlFor="f-grace"><Input id="f-grace" type="number" inputMode="numeric" value={p.graceDays} onChange={(e) => set({ graceDays: num(e.target.value) })} /></Field>
        <Field label="Most per book (GH₵)" htmlFor="f-max" hint="0 for no limit."><Input id="f-max" type="number" inputMode="decimal" value={cedis(p.maxFinePerItem)} onChange={(e) => set({ maxFinePerItem: pesewas(e.target.value) })} /></Field>
        <Field label="Stop borrowing when owed (GH₵)" htmlFor="f-block" hint="0 never stops borrowing for fines."><Input id="f-block" type="number" inputMode="decimal" value={cedis(p.blockAtFines)} onChange={(e) => set({ blockAtFines: pesewas(e.target.value) })} /></Field>
        <Field label="Lost book fee (GH₵)" htmlFor="f-lost"><Input id="f-lost" type="number" inputMode="decimal" value={cedis(p.lostItemFee)} onChange={(e) => set({ lostItemFee: pesewas(e.target.value) })} /></Field>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Reservations and reminders</legend>
        <Field label="Keep reserved books (days)" htmlFor="h-days"><Input id="h-days" type="number" inputMode="numeric" value={p.holdDays} onChange={(e) => set({ holdDays: num(e.target.value) })} /></Field>
        <Field label="Reservations per borrower" htmlFor="h-max"><Input id="h-max" type="number" inputMode="numeric" value={p.maxReservations} onChange={(e) => set({ maxReservations: num(e.target.value) })} /></Field>
        <Field label="Remind before due (days)" htmlFor="h-rem"><Input id="h-rem" type="number" inputMode="numeric" value={p.dueReminderDays} onChange={(e) => set({ dueReminderDays: num(e.target.value) })} /></Field>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Days the library is closed</legend>
        <p className="mb-2 text-xs text-muted">Books never fall due on these days; the due date moves to the next open day.</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_NAMES.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm">
              <input type="checkbox" className="size-4" checked={p.closedDays.includes(i)} onChange={(e) => set({ closedDays: e.target.checked ? [...p.closedDays, i] : p.closedDays.filter((x) => x !== i) })} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <section className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm">
        {problems.length ? (
          <ul className="list-disc pl-5 text-danger">{problems.map((x) => <li key={x}>{x}</li>)}</ul>
        ) : (
          <p>
            Example: a student returns a book 10 days late and is fined {formatCedis(p.finePerDay === 0 ? 0 : Math.min(Math.max(0, 10 - p.graceDays) * p.finePerDay, p.maxFinePerItem || Infinity))}. They can
            borrow {p.student.maxItems} books for {p.student.loanDays} days and cannot borrow again while they owe {formatCedis(p.blockAtFines)} or more.
          </p>
        )}
      </section>
      <div><Button onClick={save} loading={busy} disabled={problems.length > 0}>Save rules</Button></div>
    </div>
  );
}
