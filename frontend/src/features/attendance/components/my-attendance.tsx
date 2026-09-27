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
import { attendanceApi, classWhen, KIND_LABEL, STATUS_LABEL, STATUS_TONE, type MyAttendance as Data } from '../api';
import { AttendanceBar } from './attendance-bar';

export function MyAttendance() {
  const params = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [code, setCode] = useState(params.get('code') ?? '');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  const load = () => attendanceApi.mine().then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, []);

  const submit = async (value = code, sessionId = params.get('session') ?? undefined) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await attendanceApi.checkIn(value, sessionId);
      setResult(r.alreadyRecorded ? `You were already recorded for ${r.course.code}.` : `Checked in to ${r.course.code}${r.status === 'LATE' ? ' (late)' : ''}.`);
      setCode('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Scanning the QR code opens this page with the code filled in; check in straight away.
  useEffect(() => {
    const c = params.get('code');
    if (c && !autoTried.current) {
      autoTried.current = true;
      void submit(c);
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data && !error) return <Spinner />;
  const open = data?.upcoming.filter((u) => u.checkInOpen) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Check in to a class" description={open.length ? `Check-in is open for ${open.map((o) => o.course.code).join(', ')}.` : 'Enter the code your lecturer shows when check-in opens.'} />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="sm:w-56">
              <Field label="Code on the screen" htmlFor="checkin-code">
                <Input
                  id="checkin-code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={6}
                  className="font-mono text-lg tracking-widest uppercase"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </Field>
            </div>
            <Button type="submit" loading={busy} disabled={code.trim().length !== 6}>Check in</Button>
          </form>
          <div className="mt-3 flex flex-col gap-2">
            {result && <Alert tone="success">{result}</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </CardBody>
      </Card>

      {data && data.courses.length === 0 && <EmptyState title="No approved courses this semester" />}
      {data && data.courses.length > 0 && (
        <>
          <p className="text-sm text-muted">{data.semester.label}. You need at least {data.policy.minimumPercent}% in each course to be eligible for its exam. Excused absences do not count against you.</p>
          {data.courses.map((c) => (
            <Card key={c.offeringId}>
              <CardHeader
                title={`${c.course.code} ${c.course.title}`}
                actions={<AttendanceBar percent={c.summary?.percent ?? null} minimum={data.policy.minimumPercent} />}
              />
              {c.belowMinimum && (
                <div className="px-4 pt-3 sm:px-5">
                  <Alert tone="danger">Below the {data.policy.minimumPercent}% minimum. Attend every remaining class. If you were ill or had another valid reason, take your documents to Health Services or the Dean of Students.</Alert>
                </div>
              )}
              {c.history.length > 0 ? (
                <ul className="divide-y divide-border">
                  {c.history.slice(0, 6).map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-5">
                      <span>{new Date(h.startsAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short' })}, {KIND_LABEL[h.kind]}{h.topic ? `: ${h.topic}` : ''}</span>
                      <Badge tone={STATUS_TONE[h.status]}>{STATUS_LABEL[h.status]}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-muted sm:px-5">No classes recorded yet.</p>
              )}
            </Card>
          ))}
          {data.upcoming.length > 0 && (
            <Card>
              <CardHeader title="Your next classes" />
              <ul className="divide-y divide-border">
                {data.upcoming.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-5">
                    <span><span className="font-mono">{u.course.code}</span> {classWhen(u.startsAt, u.durationMinutes)}{u.venue ? `, ${u.venue}` : ''}</span>
                    {u.checkInOpen && <Badge tone="primary">Check-in open</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
