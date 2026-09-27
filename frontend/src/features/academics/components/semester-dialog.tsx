'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { academicsApi, type Semester } from '../api';

export function SemesterDialog({ semester, onClose, onSaved }: { semester: Semester | null; onClose: () => void; onSaved: (s: Semester) => void }) {
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [makeCurrent, setMakeCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!semester) return;
    setOpens(toLocalInput(semester.registrationOpensAt));
    setCloses(toLocalInput(semester.registrationClosesAt));
    setMin(String(semester.minCredits));
    setMax(String(semester.maxCredits));
    setMakeCurrent(false);
    setError(null);
  }, [semester]);

  if (!semester) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await academicsApi.updateSemester(semester.id, {
          registrationOpensAt: fromLocalInput(opens),
          registrationClosesAt: fromLocalInput(closes),
          minCredits: Number(min),
          maxCredits: Number(max),
          ...(makeCurrent ? { isCurrent: true } : {}),
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={semester.label} description="Students can choose and submit courses only between these times.">
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration opens" htmlFor="sem-opens">
            <Input id="sem-opens" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />
          </Field>
          <Field label="Registration closes" htmlFor="sem-closes">
            <Input id="sem-closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </Field>
          <Field label="Minimum credits" htmlFor="sem-min">
            <Input id="sem-min" type="number" inputMode="numeric" min={0} max={40} value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
          <Field label="Maximum credits" htmlFor="sem-max">
            <Input id="sem-max" type="number" inputMode="numeric" min={1} max={40} value={max} onChange={(e) => setMax(e.target.value)} />
          </Field>
        </div>
        {!semester.isCurrent && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
            Make this the current semester. Pages that say &ldquo;current semester&rdquo; will switch to it for everyone.
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save semester
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
