'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/cn';
import { attendanceApi, classWhen, KIND_LABEL, STATUS_LABEL, type Register } from '../api';
import { CheckInScreen } from './check-in-screen';

type Mark = 'PRESENT' | 'LATE' | 'ABSENT';
const MARKS: Mark[] = ['PRESENT', 'LATE', 'ABSENT'];

export function RegisterView({ offeringId, sessionId, courseLabel, onBack }: { offeringId: string; sessionId: string; courseLabel: string; onBack: () => void }) {
  const [reg, setReg] = useState<Register | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'open' | null>(null);
  const [showCode, setShowCode] = useState(false);

  const apply = (r: Register) => {
    setReg(r);
    setMarks(Object.fromEntries(r.students.filter((s) => s.status && s.status !== 'EXCUSED').map((s) => [s.id, s.status as Mark])));
    setShowCode(r.session.checkInOpen);
  };

  const load = () => attendanceApi.register(offeringId, sessionId).then(apply).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, [offeringId, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const markable = useMemo(() => reg?.students.filter((s) => !s.excused) ?? [], [reg]);
  const unmarked = markable.filter((s) => !marks[s.id]).length;

  if (error && !reg) return <Alert tone="danger">{error}</Alert>;
  if (!reg) return <Spinner />;

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      apply(await attendanceApi.saveRegister(offeringId, sessionId, markable.map((s) => ({ studentId: s.id, status: marks[s.id] ?? 'ABSENT' }))));
      setNotice('Register saved.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openCheckIn = async () => {
    setBusy('open');
    setError(null);
    try {
      await attendanceApi.openCheckIn(offeringId, sessionId);
      setShowCode(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const s = reg.session;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">All classes</button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print register</Button>
      </div>
      <div>
        <h2 className="text-lg font-semibold">{courseLabel}</h2>
        <p className="text-sm text-muted">
          {KIND_LABEL[s.kind]}, {classWhen(s.startsAt, s.durationMinutes)}{s.venue ? `, ${s.venue}` : ''}{s.topic ? `. ${s.topic}` : ''}
        </p>
        {s.attendanceTakenAt && <p className="text-xs text-muted">Register first saved {formatDateTime(s.attendanceTakenAt)}.</p>}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {showCode ? (
        <div className="print:hidden">
          <CheckInScreen offeringId={offeringId} sessionId={sessionId} onClose={() => { setShowCode(false); setNotice('Check-in closed.'); void load(); }} />
        </div>
      ) : (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p className="text-sm">Let students check themselves in with a code on the projector, or mark the register below.</p>
          <Button variant="secondary" loading={busy === 'open'} onClick={openCheckIn}>Start self check-in</Button>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted">{unmarked > 0 ? `${unmarked} not marked yet. They will be saved as absent.` : 'Everyone is marked.'}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMarks(Object.fromEntries(markable.map((st) => [st.id, marks[st.id] ?? 'PRESENT'])))}>Mark the rest present</Button>
          <Button size="sm" loading={busy === 'save'} onClick={save}>Save register</Button>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {reg.students.map((st) => (
          <li key={st.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 text-sm">
              <span className="font-mono text-xs text-muted">{st.indexNumber}</span> {fullName(st)}
              {st.source === 'CHECK_IN' && st.checkedInAt && <span className="block text-xs text-muted">Checked in {new Date(st.checkedInAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit' })}</span>}
            </span>
            {st.excused ? (
              <Badge tone="neutral">Excused</Badge>
            ) : (
              <>
              <span className="hidden text-sm print:inline">{marks[st.id] ? STATUS_LABEL[marks[st.id]] : 'Not marked'}</span>
              <span role="radiogroup" aria-label={`Attendance for ${fullName(st)}`} className="inline-flex shrink-0 rounded-md border border-border p-0.5 print:hidden">
                {MARKS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={marks[st.id] === m}
                    onClick={() => setMarks((x) => ({ ...x, [st.id]: m }))}
                    className={cn(
                      'h-9 min-w-20 rounded px-2 text-sm',
                      marks[st.id] === m
                        ? m === 'PRESENT' ? 'bg-success-soft font-medium text-success' : m === 'LATE' ? 'bg-warning-soft font-medium text-warning' : 'bg-danger-soft font-medium text-danger'
                        : 'text-muted hover:bg-surface-muted',
                    )}
                  >
                    {STATUS_LABEL[m]}
                  </button>
                ))}
              </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
