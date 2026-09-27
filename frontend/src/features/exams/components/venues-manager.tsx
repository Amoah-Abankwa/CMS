'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { examsApi, type Venue } from '../api';

export function VenuesManager() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [editing, setEditing] = useState<Partial<Venue> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => examsApi.venues().then(setVenues).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await examsApi.saveVenue({ name: editing.name ?? '', capacity: Number(editing.capacity), location: editing.location || null, isActive: editing.isActive ?? true }, editing.id);
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!venues && !error) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" onClick={() => setEditing({ isActive: true })}>Add venue</Button>
      </div>
      {error && !editing && <Alert tone="danger">{error}</Alert>}
      {venues?.length === 0 && <EmptyState title="No venues yet" description="Add the halls and rooms used for exams, with their seat counts." />}
      {venues && venues.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {venues.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{v.name}</span> {!v.isActive && <Badge>Not in use</Badge>}
                <span className="block text-xs text-muted">{v.capacity} seats{v.location ? `. ${v.location}` : ''}</span>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setEditing(v)}>Edit</Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit venue' : 'Add venue'}>
        <form onSubmit={save} className="flex flex-col gap-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Name" htmlFor="venue-name">
            <Input id="venue-name" value={editing?.name ?? ''} onChange={(e) => setEditing((v) => ({ ...v, name: e.target.value }))} />
          </Field>
          <Field label="Exam seats" htmlFor="venue-cap" hint="Seats usable under exam spacing, not the room's full capacity.">
            <Input id="venue-cap" type="number" inputMode="numeric" min={1} value={editing?.capacity ?? ''} onChange={(e) => setEditing((v) => ({ ...v, capacity: Number(e.target.value) }))} />
          </Field>
          <Field label="Location (optional)" htmlFor="venue-loc">
            <Input id="venue-loc" value={editing?.location ?? ''} onChange={(e) => setEditing((v) => ({ ...v, location: e.target.value }))} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={editing?.isActive ?? true} onChange={(e) => setEditing((v) => ({ ...v, isActive: e.target.checked }))} />
            Available for exams
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={busy}>Save venue</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
