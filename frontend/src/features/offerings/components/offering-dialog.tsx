'use client';

import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { lecturerName, offeringsApi, type LecturerOption, type Offering } from '../api';

interface Props {
  offering: Offering | null;
  lecturerOptions: LecturerOption[];
  onClose: () => void;
  onChanged: () => void;
}

/** Seat limit, lecturers (with one lead) and removal for a single offering. */
export function OfferingDialog({ offering, lecturerOptions, onClose, onChanged }: Props) {
  const [assigned, setAssigned] = useState<Array<{ userId: string; isLead: boolean }>>([]);
  const [capacity, setCapacity] = useState('');
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'lecturers' | 'capacity' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!offering) return;
    setAssigned(offering.lecturers.map((l) => ({ userId: l.id, isLead: l.isLead })));
    setCapacity(offering.capacity ? String(offering.capacity) : '');
    setPick('');
    setError(null);
    setNotice(null);
    setConfirmRemove(false);
  }, [offering]);

  if (!offering) return null;
  const nameOf = (id: string) => {
    const opt = lecturerOptions.find((l) => l.id === id);
    return opt ? lecturerName(opt) : offering.lecturers.find((l) => l.id === id)?.name ?? 'Unknown';
  };

  const run = async (kind: 'lecturers' | 'capacity' | 'remove', fn: () => Promise<unknown>, done: string) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      onChanged();
      if (kind === 'remove') onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const addLecturer = () => {
    if (!pick || assigned.some((a) => a.userId === pick)) return;
    setAssigned((a) => [...a, { userId: pick, isLead: a.length === 0 }]);
    setPick('');
  };

  const removeLecturer = (id: string) =>
    setAssigned((a) => {
      const next = a.filter((x) => x.userId !== id);
      if (next.length && !next.some((x) => x.isLead)) next[0] = { ...next[0], isLead: true };
      return next;
    });

  return (
    <Dialog open onClose={onClose} title={`${offering.course.code} ${offering.course.title}`} description={`${offering.enrolled} approved students`}>
      <div className="flex flex-col gap-5">
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Lecturers</h3>
          {assigned.length === 0 ? (
            <p className="text-sm text-muted">No lecturer assigned yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {assigned.map((a) => (
                <li key={a.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{nameOf(a.userId)}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAssigned((list) => list.map((x) => ({ ...x, isLead: x.userId === a.userId })))}
                      aria-pressed={a.isLead}
                      className={cn('flex h-8 items-center gap-1 rounded px-2 text-xs', a.isLead ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:bg-surface-muted')}
                    >
                      <Star className="size-3.5" aria-hidden />
                      {a.isLead ? 'Lead' : 'Make lead'}
                    </button>
                    <button type="button" onClick={() => removeLecturer(a.userId)} className="grid size-8 place-items-center rounded text-muted hover:bg-surface-muted" aria-label={`Remove ${nameOf(a.userId)}`}>
                      <X className="size-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <label htmlFor="add-lecturer" className="sr-only">
              Add a lecturer
            </label>
            <Select id="add-lecturer" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Add a lecturer or teaching assistant</option>
              {lecturerOptions
                .filter((l) => !assigned.some((a) => a.userId === l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {lecturerName(l)}
                    {l.staffProfile?.department ? `, ${l.staffProfile.department.name}` : ''}
                  </option>
                ))}
            </Select>
            <Button variant="secondary" onClick={addLecturer} disabled={!pick}>
              Add
            </Button>
          </div>
          <div>
            <Button size="sm" loading={busy === 'lecturers'} onClick={() => run('lecturers', () => offeringsApi.setLecturers(offering.id, assigned), 'Lecturers saved. Newly assigned lecturers have been notified.')}>
              Save lecturers
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Seat limit</h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Maximum students" htmlFor="capacity" hint="Leave empty for no limit.">
                <Input id="capacity" type="number" inputMode="numeric" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </Field>
            </div>
            <Button variant="secondary" loading={busy === 'capacity'} onClick={() => run('capacity', () => offeringsApi.updateCapacity(offering.id, capacity ? Number(capacity) : null), 'Seat limit saved.')}>
              Save limit
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-4">
          {confirmRemove ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Remove {offering.course.code} from this semester? This only works if no student has chosen it.</p>
              <div className="flex gap-2">
                <Button variant="danger" size="sm" loading={busy === 'remove'} onClick={() => run('remove', () => offeringsApi.remove(offering.id), 'Course removed.')}>
                  Remove course
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} className="self-start text-sm text-danger hover:underline">
              Remove from this semester
            </button>
          )}
        </section>
      </div>
    </Dialog>
  );
}
