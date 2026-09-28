'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/cn';
import { registrationApi, type MyRegistration } from '../api';
import { RegistrationStatus } from './registration-status';

export function RegistrationPlanner() {
  const me = useAuthStore((s) => s.me);
  const [data, setData] = useState<MyRegistration | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | 'withdraw' | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const apply = (d: MyRegistration) => {
    setData(d);
    setSelected(new Set(d.registration?.offeringIds ?? []));
  };

  useEffect(() => {
    registrationApi.mine().then(apply).catch((err) => setError(errorMessage(err)));
  }, []);

  const saved = useMemo(() => new Set(data?.registration?.offeringIds ?? []), [data]);
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));
  const credits = useMemo(
    () => (data ? data.available.filter((o) => selected.has(o.id)).reduce((s, o) => s + o.course.creditHours, 0) : 0),
    [data, selected],
  );

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;

  const status = data.registration?.status;
  const editable = data.semester.registrationOpen && (!status || status === 'DRAFT' || status === 'REJECTED');
  const { minCredits, maxCredits } = data.semester;
  const creditTone = credits > maxCredits ? 'danger' : credits >= minCredits ? 'success' : 'neutral';
  const chosen = data.available.filter((o) => selected.has(o.id));

  const act = async (kind: 'save' | 'submit' | 'withdraw') => {
    setBusy(kind);
    setError(null);
    setSavedNotice(false);
    try {
      if (kind === 'withdraw') apply(await registrationApi.withdraw());
      else {
        let next = data;
        if (dirty || status === 'REJECTED' || !data.registration) next = await registrationApi.save([...selected]);
        if (kind === 'submit') next = await registrationApi.submit();
        apply(next);
        if (kind === 'save') setSavedNotice(true);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Printed registration slip */}
      <div className="hidden print:block">
        <p className="text-lg font-bold">All Nations University</p>
        <p className="font-semibold">Course registration slip, {data.semester.label}</p>
        <p className="text-sm">
          {me && fullName(me)}, {me?.indexNumber}. {data.profile.programme.name}, level {data.profile.level}.
        </p>
        <p className="mb-3 text-sm">
          Status: {status?.toLowerCase()}
          {data.registration?.reviewedBy ? `, approved by ${data.registration.reviewedBy}` : ''}
          {data.registration?.reviewedAt ? ` on ${formatDateTime(data.registration.reviewedAt)}` : ''}. Printed {formatDateTime(new Date())}.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted">
          {data.semester.label}. {data.profile.programme.name}, level {data.profile.level}. Credits allowed: {minCredits} to {maxCredits}.
        </p>
        {status === 'APPROVED' && (
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print registration slip
          </Button>
        )}
      </div>

      <div className="print:hidden">
        <RegistrationStatus data={data} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {savedNotice && <Alert tone="success">Saved. Submit when you are ready.</Alert>}

      <Card>
        <CardHeader title={editable ? 'Courses you can take' : 'Your courses'} />
        {data.available.length === 0 ? (
          <EmptyState title="No courses offered for your level yet" description="Your department has not published this semester's courses. Check back soon." />
        ) : (
          <ul className="divide-y divide-border">
            {(editable ? data.available : chosen).map((o) => {
              const checked = selected.has(o.id);
              const full = o.capacity !== null && o.seatsTaken >= o.capacity && !saved.has(o.id);
              const lead = o.lecturers.find((l) => l.isLead) ?? o.lecturers[0];
              return (
                <li key={o.id}>
                  <label className={cn('flex items-start gap-3 px-4 py-3 sm:px-5', editable && !full && 'cursor-pointer hover:bg-surface-muted', checked && editable && 'bg-primary-soft/40')}>
                    {editable && (
                      <input type="checkbox" className="mt-1 size-4 shrink-0 print:hidden" checked={checked} disabled={full && !checked} onChange={() => toggle(o.id)} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-medium">
                          <span className="font-mono">{o.course.code}</span> {o.course.title}{o.carryOver && <span className="ml-2 rounded-sm bg-warning-soft px-1.5 py-0.5 text-xs font-medium">Carry-over</span>}
                        </span>
                        <span className="text-sm tabular-nums text-muted">{o.course.creditHours} credits</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {lead ? lead.name : 'Lecturer to be announced'}
                        {o.capacity !== null && <span>{Math.max(0, o.capacity - o.seatsTaken)} seats left</span>}
                        {full && <Badge tone="danger">Full</Badge>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Running total and actions; stays in view on phones while scrolling the course list. */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-surface px-4 py-3 sm:mx-0 sm:rounded-lg sm:border print:static print:border-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {selected.size} {selected.size === 1 ? 'course' : 'courses'},{' '}
            <Badge tone={creditTone}>
              {credits} of {minCredits} to {maxCredits} credits
            </Badge>
          </p>
          <div className="flex flex-wrap gap-2 print:hidden">
            {editable && (
              <>
                <Button variant="secondary" loading={busy === 'save'} disabled={!dirty && status !== 'REJECTED' && !!data.registration} onClick={() => act('save')}>
                  Save
                </Button>
                <Button loading={busy === 'submit'} disabled={selected.size === 0 || credits < minCredits || credits > maxCredits} onClick={() => act('submit')}>
                  Submit for approval
                </Button>
              </>
            )}
            {status === 'SUBMITTED' && data.semester.registrationOpen && (
              <Button variant="secondary" loading={busy === 'withdraw'} onClick={() => act('withdraw')}>
                Withdraw to make changes
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
