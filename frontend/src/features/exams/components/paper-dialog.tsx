'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { examsApi, type Paper, type StaffOption, type TimetableView, type Venue } from '../api';

export interface PaperTarget {
  offeringId: string;
  label: string;
  students: number;
  paper?: Paper;
}

interface Props {
  target: PaperTarget | null;
  venues: Venue[];
  staff: StaffOption[];
  onClose: () => void;
  onSaved: (view: TimetableView) => void;
}

export function PaperDialog({ target, venues, staff, onClose, onSaved }: Props) {
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState('120');
  const [venueId, setVenueId] = useState('');
  const [invigilators, setInvigilators] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);

  useEffect(() => {
    if (!target) return;
    const p = target.paper;
    setStartsAt(toLocalInput(p?.startsAt));
    setDuration(String(p?.durationMinutes ?? 120));
    setVenueId(p?.venue?.id ?? '');
    setInvigilators(p?.invigilators.map((i) => i.id) ?? []);
    setNotes(p?.notes ?? '');
    setPick('');
    setError(null);
  }, [target]);

  if (!target) return null;
  const venue = venues.find((v) => v.id === venueId);
  const name = (id: string) => {
    const s = staff.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : target.paper?.invigilators.find((i) => i.id === id)?.name ?? 'Staff member';
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startsAt) return setError('Choose the date and start time.');
    setBusy('save');
    setError(null);
    try {
      onSaved(await examsApi.savePaper({ offeringId: target.offeringId, startsAt: fromLocalInput(startsAt)!, durationMinutes: Number(duration), venueId: venueId || null, invigilatorIds: invigilators, notes: notes.trim() || undefined }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!target.paper) return;
    setBusy('remove');
    try {
      onSaved(await examsApi.removePaper(target.paper.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onClose={onClose} title={target.paper ? `Edit ${target.label}` : `Schedule ${target.label}`} description={`${target.students} approved students`}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date and start time" htmlFor="paper-start">
            <Input id="paper-start" type="datetime-local" step={900} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Length" htmlFor="paper-duration">
            <Select id="paper-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {[60, 90, 120, 150, 180].map((m) => (
                <option key={m} value={m}>
                  {m / 60} {m === 60 ? 'hour' : 'hours'}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Venue"
          htmlFor="paper-venue"
          hint={venue && venue.capacity < target.students ? `${venue.name} seats ${venue.capacity}, fewer than the ${target.students} students.` : 'Several papers can share a hall if the seats allow.'}
        >
          <Select id="paper-venue" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">To be announced</option>
            {venues.filter((v) => v.isActive).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.capacity} seats)
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Invigilators</p>
          {invigilators.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {invigilators.map((id) => (
                <li key={id} className="inline-flex items-center gap-1 rounded bg-surface-muted py-0.5 pl-2 pr-1 text-sm">
                  {name(id)}
                  <button type="button" onClick={() => setInvigilators((l) => l.filter((x) => x !== id))} className="grid size-6 place-items-center rounded text-muted hover:bg-border" aria-label={`Remove ${name(id)}`}>
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <label htmlFor="paper-invigilator" className="sr-only">
              Add an invigilator
            </label>
            <Select id="paper-invigilator" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Add an invigilator</option>
              {staff.filter((s) => !invigilators.includes(s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                  {s.staffProfile?.department ? `, ${s.staffProfile.department.name}` : ''}
                </option>
              ))}
            </Select>
            <Button variant="secondary" disabled={!pick} onClick={() => { setInvigilators((l) => [...l, pick]); setPick(''); }}>
              Add
            </Button>
          </div>
        </div>
        <Field label="Note for students (optional)" htmlFor="paper-notes" hint="For example: bring a scientific calculator.">
          <Textarea id="paper-notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-between gap-2">
          {target.paper ? (
            <Button variant="ghost" className="text-danger" loading={busy === 'remove'} onClick={remove}>
              Remove from timetable
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy === 'save'}>
              Save paper
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
