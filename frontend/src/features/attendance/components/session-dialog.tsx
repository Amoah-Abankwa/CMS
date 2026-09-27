'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { attendanceApi, KIND_LABEL, type ClassAttendance, type ClassSession, type SessionKind } from '../api';

interface Props {
  open: boolean;
  offeringId: string;
  session?: ClassSession | null;
  onClose: () => void;
  onSaved: (data: ClassAttendance) => void;
}

/** Add one class, or a weekly series, or edit a class that has no register yet. */
export function SessionDialog({ open, offeringId, session, onClose, onSaved }: Props) {
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState('120');
  const [kind, setKind] = useState<SessionKind>('LECTURE');
  const [topic, setTopic] = useState('');
  const [venue, setVenue] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'cancel' | null>(null);

  useEffect(() => {
    if (!open) return;
    setStartsAt(toLocalInput(session?.startsAt));
    setDuration(String(session?.durationMinutes ?? 120));
    setKind(session?.kind ?? 'LECTURE');
    setTopic(session?.topic ?? '');
    setVenue(session?.venue ?? '');
    setRepeatUntil('');
    setCancelReason('');
    setError(null);
  }, [open, session]);

  if (!open) return null;
  const weeks = repeatUntil && startsAt ? Math.floor((new Date(`${repeatUntil}T23:59`).getTime() - new Date(startsAt).getTime()) / (7 * 86_400_000)) + 1 : 1;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startsAt) return setError('Choose the date and start time.');
    setBusy('save');
    setError(null);
    try {
      const input = { startsAt: fromLocalInput(startsAt)!, durationMinutes: Number(duration), kind, topic: topic.trim() || undefined, venue: venue.trim() || undefined };
      onSaved(session ? await attendanceApi.updateSession(offeringId, session.id, input) : await attendanceApi.createSessions(offeringId, { ...input, repeatWeeklyUntil: repeatUntil || undefined }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const cancelClass = async () => {
    if (!session) return;
    setBusy('cancel');
    try {
      onSaved(await attendanceApi.cancelSession(offeringId, session.id, cancelReason.trim()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onClose={onClose} title={session ? 'Edit class' : 'Add classes'}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date and start time" htmlFor="cls-start">
            <Input id="cls-start" type="datetime-local" step={900} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Length" htmlFor="cls-duration">
            <Select id="cls-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {[60, 90, 120, 180].map((m) => <option key={m} value={m}>{m / 60} {m === 60 ? 'hour' : 'hours'}</option>)}
            </Select>
          </Field>
          <Field label="Type" htmlFor="cls-kind">
            <Select id="cls-kind" value={kind} onChange={(e) => setKind(e.target.value as SessionKind)}>
              {(Object.keys(KIND_LABEL) as SessionKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Field label="Room (optional)" htmlFor="cls-venue">
            <Input id="cls-venue" value={venue} maxLength={80} onChange={(e) => setVenue(e.target.value)} />
          </Field>
        </div>
        <Field label="Topic (optional)" htmlFor="cls-topic">
          <Input id="cls-topic" value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} />
        </Field>
        {!session && (
          <Field label="Repeat every week until (optional)" htmlFor="cls-repeat" hint={repeatUntil ? `${Math.min(weeks, 20)} classes will be added (at most 20).` : 'Leave empty to add a single class.'}>
            <Input id="cls-repeat" type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy === 'save'}>{session ? 'Save class' : weeks > 1 && repeatUntil ? 'Add classes' : 'Add class'}</Button>
        </div>
        {session && !session.attendanceTakenAt && (
          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium">Cancel this class</p>
            <div className="flex gap-2">
              <label htmlFor="cls-cancel" className="sr-only">Reason for cancelling</label>
              <Input id="cls-cancel" placeholder="Reason, e.g. public holiday" value={cancelReason} maxLength={200} onChange={(e) => setCancelReason(e.target.value)} />
              <Button variant="danger" loading={busy === 'cancel'} disabled={cancelReason.trim().length < 3} onClick={cancelClass}>Cancel class</Button>
            </div>
            <p className="text-xs text-muted">A cancelled class does not count towards anyone&rsquo;s attendance.</p>
          </section>
        )}
      </form>
    </Dialog>
  );
}
