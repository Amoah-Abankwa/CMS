'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/axios';
import type { TitleInput } from '../api';

const split = (s: string) => s.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);

export function TitleFormDialog({ open, initial, onClose, onSave, onSaved }: { open: boolean; initial?: Partial<TitleInput> & { description?: string | null }; onClose: () => void; onSave: (dto: TitleInput) => Promise<unknown>; onSaved: (result: unknown) => void }) {
  const [f, setF] = useState({ title: '', subtitle: '', authors: '', isbn: '', publisher: '', year: '', edition: '', callNumber: '', subjects: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({
      title: initial?.title ?? '', subtitle: initial?.subtitle ?? '', authors: (initial?.authors ?? []).join('; '), isbn: initial?.isbn ?? '', publisher: initial?.publisher ?? '',
      year: initial?.year ? String(initial.year) : '', edition: initial?.edition ?? '', callNumber: initial?.callNumber ?? '', subjects: (initial?.subjects ?? []).join('; '), description: initial?.description ?? '',
    });
    setError(null);
  }, [open, initial]);

  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await onSave({
        title: f.title.trim(), subtitle: f.subtitle.trim() || undefined, authors: split(f.authors), isbn: f.isbn.trim() || undefined, publisher: f.publisher.trim() || undefined,
        year: f.year ? Number(f.year) : undefined, edition: f.edition.trim() || undefined, callNumber: f.callNumber.trim() || undefined, subjects: split(f.subjects), description: f.description.trim() || undefined,
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={initial?.title ? 'Edit title' : 'Add a title'}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Title" htmlFor="t-title"><Input id="t-title" value={f.title} maxLength={250} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Subtitle (optional)" htmlFor="t-sub"><Input id="t-sub" value={f.subtitle} maxLength={250} onChange={(e) => set('subtitle', e.target.value)} /></Field>
        <Field label="Authors" htmlFor="t-auth" hint="Separate several authors with a semicolon."><Input id="t-auth" value={f.authors} onChange={(e) => set('authors', e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ISBN (optional)" htmlFor="t-isbn"><Input id="t-isbn" inputMode="numeric" value={f.isbn} onChange={(e) => set('isbn', e.target.value)} /></Field>
          <Field label="Call number (optional)" htmlFor="t-call"><Input id="t-call" value={f.callNumber} maxLength={60} onChange={(e) => set('callNumber', e.target.value)} /></Field>
          <Field label="Publisher (optional)" htmlFor="t-pub"><Input id="t-pub" value={f.publisher} maxLength={120} onChange={(e) => set('publisher', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" htmlFor="t-year"><Input id="t-year" type="number" inputMode="numeric" value={f.year} onChange={(e) => set('year', e.target.value)} /></Field>
            <Field label="Edition" htmlFor="t-ed"><Input id="t-ed" value={f.edition} maxLength={40} onChange={(e) => set('edition', e.target.value)} /></Field>
          </div>
        </div>
        <Field label="Subjects (optional)" htmlFor="t-subj" hint="Separate with semicolons. Used in search."><Input id="t-subj" value={f.subjects} onChange={(e) => set('subjects', e.target.value)} /></Field>
        <Field label="Description (optional)" htmlFor="t-desc"><Textarea id="t-desc" value={f.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!f.title.trim() || !split(f.authors).length}>Save title</Button>
        </div>
      </form>
    </Dialog>
  );
}
