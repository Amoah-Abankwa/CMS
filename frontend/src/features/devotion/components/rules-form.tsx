'use client';

import { useEffect, useMemo, useState } from 'react';
import { devotionScore, validateDevotionPolicy, WEEKDAY_NAMES, type DevotionPolicy, type DevotionStatus } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { devotionApi } from '../api';
import { RulesSummary } from './rules-summary';

/** Worked example so the Chaplaincy can see the effect of a change before saving it. */
const EXAMPLE = [...Array(30).fill('EARLY'), ...Array(8).fill('LATE'), ...Array(2).fill('ABSENT')] as DevotionStatus[];

export function RulesForm() {
  const [policy, setPolicy] = useState<DevotionPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    devotionApi.policy().then(setPolicy).catch((err) => setError(errorMessage(err)));
  }, []);

  const problems = useMemo(() => (policy ? validateDevotionPolicy(policy) : []), [policy]);
  if (!policy) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const set = (patch: Partial<DevotionPolicy>) => { setPolicy({ ...policy, ...patch }); setSaved(false); };
  const example = devotionScore(EXAMPLE, policy);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      setPolicy(await devotionApi.setPolicy(policy));
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
      {saved && <Alert tone="success">Rules saved. New times apply to services scheduled from now on; marks settings apply to every score.</Alert>}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Devotion days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_NAMES.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm">
              <input type="checkbox" className="size-4" checked={policy.days.includes(i)} onChange={(e) => set({ days: e.target.checked ? [...policy.days, i].sort() : policy.days.filter((x) => x !== i) })} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Check-in opens" htmlFor="r-open"><Input id="r-open" type="time" value={policy.opensAt} onChange={(e) => set({ opensAt: e.target.value })} /></Field>
        <Field label="Devotion starts" htmlFor="r-start"><Input id="r-start" type="time" value={policy.startsAt} onChange={(e) => set({ startsAt: e.target.value })} /></Field>
        <Field label="Late from" htmlFor="r-late"><Input id="r-late" type="time" value={policy.lateFrom} onChange={(e) => set({ lateFrom: e.target.value })} /></Field>
        <Field label="Ends (absent after)" htmlFor="r-end"><Input id="r-end" type="time" value={policy.endsAt} onChange={(e) => set({ endsAt: e.target.value })} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Semester total" htmlFor="r-total" hint="What a student early for every service scores.">
          <Input id="r-total" type="number" inputMode="decimal" step="0.5" value={policy.totalMarks} onChange={(e) => set({ totalMarks: Number(e.target.value) })} />
        </Field>
        <Field label="Late earns (% of an early arrival)" htmlFor="r-credit" hint="Must be less than 100 so early always earns more.">
          <Input id="r-credit" type="number" inputMode="numeric" min={0} max={99} value={Math.round(policy.lateCredit * 100)} onChange={(e) => set({ lateCredit: Number(e.target.value) / 100 })} />
        </Field>
      </div>
      <section className="rounded-md border border-border bg-surface-muted px-4 py-3">
        {problems.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-danger">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        ) : (
          <>
            <RulesSummary policy={policy} />
            <p className="mt-3 text-sm">
              Example: 30 early, 8 late and 2 absent out of 40 services scores <span className="font-semibold tabular-nums">{example.score?.toFixed(2)}</span> out of {policy.totalMarks.toFixed(2)}.
            </p>
          </>
        )}
      </section>
      <div><Button onClick={save} loading={busy} disabled={problems.length > 0}>Save rules</Button></div>
    </div>
  );
}
