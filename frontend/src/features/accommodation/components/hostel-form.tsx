'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/axios';
import { GENDER_LABEL, type HostelGender, type HostelInput } from '../api';

interface Props {
  open: boolean;
  title: string;
  initial?: Partial<HostelInput> & { facilities?: string[] };
  /** University hostels are single-gender; private hostels may be mixed. */
  allowMixed: boolean;
  onClose: () => void;
  onSave: (dto: HostelInput) => Promise<unknown>;
  onSaved: () => void;
}

export function HostelFormDialog({ open, title, initial, allowMixed, onClose, onSave, onSaved }: Props) {
  const [f, setF] = useState({ name: '', gender: 'FEMALE' as HostelGender, location: '', digitalAddress: '', distanceNote: '', description: '', facilities: '', contactPhone: '', isActive: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({
      name: initial?.name ?? '', gender: initial?.gender ?? 'FEMALE', location: initial?.location ?? '', digitalAddress: initial?.digitalAddress ?? '',
      distanceNote: initial?.distanceNote ?? '', description: initial?.description ?? '', facilities: (initial?.facilities ?? []).join(', '),
      contactPhone: initial?.contactPhone ?? '', isActive: initial?.isActive ?? true,
    });
    setError(null);
  }, [open, initial]);

  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: f.name.trim(), gender: f.gender, location: f.location.trim() || undefined, digitalAddress: f.digitalAddress.trim() || undefined,
        distanceNote: f.distanceNote.trim() || undefined, description: f.description.trim() || undefined,
        facilities: f.facilities.split(',').map((x) => x.trim()).filter(Boolean), contactPhone: f.contactPhone.trim() || undefined, isActive: f.isActive,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="h-name"><Input id="h-name" value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="For" htmlFor="h-gender">
            <Select id="h-gender" value={f.gender} onChange={(e) => set('gender', e.target.value)}>
              {(['FEMALE', 'MALE', ...(allowMixed ? ['MIXED'] : [])] as HostelGender[]).map((g) => <option key={g} value={g}>{GENDER_LABEL[g]} students</option>)}
            </Select>
          </Field>
          <Field label="Location (optional)" htmlFor="h-loc"><Input id="h-loc" value={f.location} maxLength={120} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="GhanaPost digital address (optional)" htmlFor="h-gps"><Input id="h-gps" value={f.digitalAddress} onChange={(e) => set('digitalAddress', e.target.value.toUpperCase())} placeholder="EN-012-3456" /></Field>
          {allowMixed && <Field label="Distance to campus (optional)" htmlFor="h-dist"><Input id="h-dist" value={f.distanceNote} maxLength={120} onChange={(e) => set('distanceNote', e.target.value)} placeholder="10 minutes walk" /></Field>}
          {allowMixed && <Field label="Contact phone" htmlFor="h-phone"><Input id="h-phone" type="tel" value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></Field>}
        </div>
        <Field label="Facilities (optional)" htmlFor="h-fac" hint="Separate with commas, for example: Security, Wi-Fi, Water tank."><Input id="h-fac" value={f.facilities} onChange={(e) => set('facilities', e.target.value)} /></Field>
        <Field label="Description (optional)" htmlFor="h-desc"><Textarea id="h-desc" value={f.description} maxLength={1000} onChange={(e) => set('description', e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Open for students</label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={f.name.trim().length < 3}>Save hostel</Button>
        </div>
      </form>
    </Dialog>
  );
}
