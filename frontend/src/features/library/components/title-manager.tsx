'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { byLine, COPY_STATUS, dueLabel, libraryApi, type TitleDetail } from '../api';
import { TitleFormDialog } from './title-form';

export function TitleManager({ titleId }: { titleId: string }) {
  const [t, setT] = useState<TitleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copy, setCopy] = useState<TitleDetail['copies'][number] | null>(null);

  const load = () => libraryApi.title(titleId).then(setT).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, [titleId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.title}
        description={`${byLine(t.authors)}${t.edition ? `, ${t.edition}` : ''}${t.year ? `, ${t.year}` : ''}. ${[t.publisher, t.isbn ? `ISBN ${t.isbn}` : null, t.callNumber].filter(Boolean).join('. ')}`}
        actions={<Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit title</Button>}
      />
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Card>
        <CardHeader title={`Copies (${t.copies.length})`} actions={<Button size="sm" onClick={() => setAdding(true)}>Add copies</Button>} />
        <ul className="divide-y divide-border">
          {t.copies.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span className="min-w-0 text-sm">
                <span className="font-mono">{c.barcode}</span> <span className="text-muted">{c.shelf}</span>
                {c.loans[0] && <span className="block text-xs text-muted">With {c.loans[0].borrower.firstName} {c.loans[0].borrower.lastName} ({c.loans[0].borrower.indexNumber ?? c.loans[0].borrower.email}), due {dueLabel(c.loans[0].dueAt)}</span>}
                {c.notes && <span className="block text-xs text-muted">{c.notes}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {c.isReference && <Badge>Reference</Badge>}
                <Badge tone={COPY_STATUS[c.status].tone}>{COPY_STATUS[c.status].label}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setCopy(c)}>Edit</Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {t.reservations.length > 0 && (
        <Card>
          <CardHeader title="Reservation queue" />
          <ol className="divide-y divide-border">
            {t.reservations.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-5">
                <span>{i + 1}. {r.borrower.firstName} {r.borrower.lastName} <span className="text-xs text-muted">{r.borrower.indexNumber ?? r.borrower.email}, since {formatDateTime(r.createdAt)}</span></span>
                <Badge tone={r.status === 'READY' ? 'success' : 'primary'}>{r.status === 'READY' ? `Ready until ${r.expiresAt ? dueLabel(r.expiresAt) : ''}` : 'Waiting'}</Badge>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {t.description && <Card><CardBody><p className="text-sm">{t.description}</p></CardBody></Card>}

      <TitleFormDialog open={editing} initial={{ ...t, subtitle: t.subtitle ?? undefined, isbn: t.isbn ?? undefined, publisher: t.publisher ?? undefined, year: t.year ?? undefined, edition: t.edition ?? undefined, callNumber: t.callNumber ?? undefined }} onClose={() => setEditing(false)} onSave={(dto) => libraryApi.saveTitle(dto, titleId)} onSaved={() => { setEditing(false); setNotice('Title saved.'); void load(); }} />
      <AddCopiesDialog open={adding} titleId={titleId} defaultShelf={t.copies[0]?.shelf ?? ''} onClose={() => setAdding(false)} onDone={(n) => { setAdding(false); setNotice(`${n} copies added.`); void load(); }} />
      <CopyDialog copy={copy} onClose={() => setCopy(null)} onDone={() => { setCopy(null); setNotice('Copy saved.'); void load(); }} />
    </div>
  );
}

function AddCopiesDialog({ open, titleId, defaultShelf, onClose, onDone }: { open: boolean; titleId: string; defaultShelf: string; onClose: () => void; onDone: (n: number) => void }) {
  const [codes, setCodes] = useState('');
  const [shelf, setShelf] = useState('');
  const [reference, setReference] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setCodes(''); setShelf(defaultShelf); setReference(false); setError(null); } }, [open, defaultShelf]);
  const list = codes.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await libraryApi.addCopies(titleId, list, shelf.trim() || undefined, reference);
      onDone(r.added);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add copies" description="Scan each new barcode label; each scan adds a line.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Barcodes" htmlFor="c-codes" hint={`${list.length} copies`}><Textarea id="c-codes" className="min-h-32 font-mono uppercase" value={codes} onChange={(e) => setCodes(e.target.value)} /></Field>
        <Field label="Shelf" htmlFor="c-shelf"><Input id="c-shelf" value={shelf} maxLength={80} onChange={(e) => setShelf(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={reference} onChange={(e) => setReference(e.target.checked)} /> Reference copies (cannot be borrowed)</label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!list.length} onClick={save}>Add {list.length} copies</Button>
        </div>
      </div>
    </Dialog>
  );
}

function CopyDialog({ copy, onClose, onDone }: { copy: TitleDetail['copies'][number] | null; onClose: () => void; onDone: () => void }) {
  const [shelf, setShelf] = useState('');
  const [status, setStatus] = useState('');
  const [reference, setReference] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!copy) return;
    setShelf(copy.shelf ?? '');
    setStatus(['AVAILABLE', 'DAMAGED', 'WITHDRAWN'].includes(copy.status) ? copy.status : '');
    setReference(copy.isReference);
    setNotes(copy.notes ?? '');
    setError(null);
  }, [copy]);
  if (!copy) return null;
  const inUse = copy.status === 'ON_LOAN' || copy.status === 'ON_HOLD';
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await libraryApi.updateCopy(copy.id, { shelf: shelf.trim() || undefined, isReference: reference, notes: notes.trim() || undefined, ...(status && !inUse ? { status: status as 'AVAILABLE' } : {}) });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Copy ${copy.barcode}`} description={COPY_STATUS[copy.status].label}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Shelf" htmlFor="cp-shelf"><Input id="cp-shelf" value={shelf} maxLength={80} onChange={(e) => setShelf(e.target.value)} /></Field>
        {!inUse && (
          <Field label="Condition" htmlFor="cp-status" hint="Lost copies found again: set them back to On the shelf.">
            <Select id="cp-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="" disabled>Choose</option>
              <option value="AVAILABLE">On the shelf</option>
              <option value="DAMAGED">Damaged (not lent)</option>
              <option value="WITHDRAWN">Withdrawn from stock</option>
            </Select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={reference} onChange={(e) => setReference(e.target.checked)} /> Reference copy (cannot be borrowed)</label>
        <Field label="Notes" htmlFor="cp-notes"><Input id="cp-notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Save copy</Button>
        </div>
      </div>
    </Dialog>
  );
}
