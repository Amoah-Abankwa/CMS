'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { clock, DEVOTION_LABEL, DEVOTION_TONE, devotionApi, marks, serviceDay, type MyDevotion as Data } from '../api';
import { RulesSummary } from './rules-summary';

export function MyDevotion() {
  const params = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [code, setCode] = useState(params.get('code') ?? '');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const load = () => devotionApi.mine().then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, []);

  const submit = async (value = code) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await devotionApi.checkIn(value);
      setResult(r.alreadyRecorded ? `You were already recorded as ${DEVOTION_LABEL[r.status].toLowerCase()} today.` : `Recorded: ${DEVOTION_LABEL[r.status].toLowerCase()} at ${clock(r.arrivedAt)}.`);
      setCode('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const c = params.get('code');
    if (c && !tried.current) {
      tried.current = true;
      void submit(c);
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data && !error) return <Spinner />;
  if (!data) return <Alert tone="danger">{error}</Alert>;
  const total = data.policy.totalMarks;
  const score = data.final?.score ?? data.summary.score;

  return (
    <div className="flex flex-col gap-4">
      {!data.expected && <Alert tone="info">Devotion attendance is recorded once your course registration for {data.semester.label} is approved.</Alert>}

      <section className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="rounded-lg border border-border bg-surface px-5 py-4">
          <p className="text-xs text-muted">{data.final ? 'Final score' : 'Score so far'}, {data.semester.label}</p>
          <p className="text-4xl font-semibold tabular-nums">
            {marks(score)} <span className="text-lg font-normal text-muted">/ {total.toFixed(2)}</span>
          </p>
          {data.final && <p className="text-xs text-muted">Finalised {formatDateTime(data.final.finalizedAt)}</p>}
        </div>
        <dl className="grid grid-cols-4 gap-2">
          {(['early', 'late', 'absent', 'excused'] as const).map((k) => (
            <div key={k} className="rounded-lg border border-border bg-surface px-3 py-3">
              <dt className="text-xs capitalize text-muted">{k}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{data.summary[k]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Card>
        <CardHeader
          title="Check in"
          description={data.next ? `Next: ${serviceDay(data.next.date)}. Early until ${clock(data.next.lateFrom)}, late until ${clock(data.next.endsAt)}.` : 'No upcoming service this semester.'}
        />
        <CardBody>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-56">
              <Field label="Code on the screen" htmlFor="dev-code">
                <Input id="dev-code" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={6} className="font-mono text-lg uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </Field>
            </div>
            <Button type="submit" loading={busy} disabled={code.trim().length !== 6}>Check in</Button>
          </form>
          <p className="mt-2 text-xs text-muted">Or show your student ID to an usher at the door.</p>
          <div className="mt-3 flex flex-col gap-2">
            {result && <Alert tone="success">{result}</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="How your score works" />
        <CardBody><RulesSummary policy={data.policy} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Your record" />
        {data.history.length === 0 ? (
          <EmptyState title="No services recorded yet" />
        ) : (
          <ul className="divide-y divide-border">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-5">
                <span>
                  {serviceDay(h.date)}
                  {h.theme && <span className="text-muted">, {h.theme}</span>}
                  {h.arrivedAt && <span className="block text-xs text-muted">Arrived {clock(h.arrivedAt)}</span>}
                </span>
                <Badge tone={DEVOTION_TONE[h.status]}>{DEVOTION_LABEL[h.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
