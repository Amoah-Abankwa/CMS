'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/input';
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

  const [mainStage, setMainStage] = useState<number | null>(null);
  const apply = (d: MyRegistration) => {
    setData(d);
    setMainStage(d.mainStage);
    // A new registration starts with the main semester's courses ticked (electives are left to choose).
    const preset = d.registration?.offeringIds ?? (d.mode === 'REGULAR' ? d.available.filter((o) => o.isMain && !o.isElective).map((o) => o.id) : []);
    setSelected(new Set(preset));
  };

  useEffect(() => {
    registrationApi.mine().then(apply).catch((err) => setError(errorMessage(err)));
  }, []);

  /** Choosing another main semester shows its courses and ticks them; other ticks that still apply stay. */
  const chooseStage = async (stage: number) => {
    setError(null);
    try {
      const d = await registrationApi.mine(stage);
      setData(d);
      setMainStage(stage);
      setSelected((prev) => new Set([...[...prev].filter((id) => d.available.some((o) => o.id === id)), ...d.available.filter((o) => o.isMain && !o.isElective).map((o) => o.id)]));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const saved = useMemo(() => new Set(data?.registration?.offeringIds ?? []), [data]);
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id)) || (data?.mode === 'REGULAR' && mainStage !== (data?.registration?.mainStage ?? null));
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
        if (dirty || status === 'REJECTED' || !data.registration) next = await registrationApi.save([...selected], data.mode === 'REGULAR' ? mainStage : null);
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
      {data.mode === 'REGULAR' && (
        <Card className="print:hidden">
          <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <Field label="Your main semester" htmlFor="rg-stage" hint={`Its courses are ticked for you. You can add any course from the semesters below it, within ${maxCredits} credits.`}>
              <Select id="rg-stage" className="w-56" disabled={!editable} value={mainStage ?? data.suggestedStage} onChange={(e) => void chooseStage(Number(e.target.value))}>
                {Array.from({ length: data.totalStages }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Semester {n}{n === data.suggestedStage ? ' (suggested)' : ''}</option>)}
              </Select>
            </Field>
            <p className="text-xs text-muted">{data.weekend ? 'Weekend programme: three semesters a year (Fall, Spring and Summer).' : 'Two semesters a year (Fall and Spring).'} {data.totalStages} semesters in all.</p>
          </CardBody>
        </Card>
      )}
      {data.mode === 'PROMOTIONAL' && <Alert tone="info">Promotional summer: you can take courses you failed or have not taken yet, up to your current level, within {maxCredits} credits.</Alert>}
      {data.mode === 'UPGRADE' && <Alert tone="info">Upgrade summer: you can retake any course up to your current level to improve your grade, within {maxCredits} credits.</Alert>}
      {data.mode === 'SUMMER_NOT_SET' && <Alert tone="warning">The academic office has not yet said whether this summer is promotional or upgrade. Registration opens once it has.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {savedNotice && <Alert tone="success">Saved. Submit when you are ready.</Alert>}

      <Card>
        <CardHeader title={editable ? 'Courses you can take' : 'Your courses'} />
        {data.available.length === 0 ? (
          <EmptyState title="No courses to show" description={data.mode === 'SUMMER_NOT_SET' ? 'Wait for the academic office to set this summer.' : "Your programme's curriculum has no courses for these semesters yet. Contact your department."} />
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
                          <span className="font-mono">{o.course.code}</span> {o.course.title}
                          {o.passed ? <Badge tone="success" className="ml-2">Passed</Badge> : o.carryOver ? <Badge tone="danger" className="ml-2">Failed</Badge> : null}
                          {o.isElective && <span className="ml-2 text-xs text-muted">elective</span>}
                        </span>
                        <span className="text-sm tabular-nums text-muted">{o.course.creditHours} credits</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>Semester {o.stage}{o.isMain ? ' (main)' : ''}</span>
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
