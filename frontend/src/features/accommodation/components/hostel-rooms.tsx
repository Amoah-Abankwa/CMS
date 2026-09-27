'use client';

import { useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { accommodationApi, ALLOCATION_LABEL, ALLOCATION_TONE, GENDER_LABEL, toPesewas, type RoomRow } from '../api';
import { HostelFormDialog } from './hostel-form';

type Data = Awaited<ReturnType<typeof accommodationApi.rooms>>;

export function HostelRooms({ hostelId }: { hostelId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingHostel, setEditingHostel] = useState(false);
  const [editing, setEditing] = useState<RoomRow | null>(null);

  const load = () => accommodationApi.rooms(hostelId).then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, [hostelId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const h = data.hostel;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={h.name}
        description={`${GENDER_LABEL[h.gender]} students. ${h.location ?? ''} ${data.semester.label}.`}
        actions={<><Button variant="secondary" size="sm" onClick={() => setEditingHostel(true)}>Edit hostel</Button><Button size="sm" onClick={() => setAdding(true)}>Add rooms</Button></>}
      />
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {data.rooms.length === 0 ? (
        <EmptyState title="No rooms yet" description="Add a range of rooms in one go, for example A101 to A120." action={<Button onClick={() => setAdding(true)}>Add rooms</Button>} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.rooms.map((r) => (
            <li key={r.id} className={cn('rounded-lg border border-border bg-surface px-3 py-2.5', !r.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <span>
                  <span className="font-medium">{r.number}</span> <span className="text-xs text-muted">{r.roomType}, {formatCedis(r.pricePerSemester)}</span>
                </span>
                <button type="button" onClick={() => setEditing(r)} className="text-xs text-primary hover:underline">Edit</button>
              </div>
              <p className="text-xs text-muted">{r.allocations.length} of {r.capacity} beds taken{!r.isActive ? '. Closed' : ''}</p>
              {r.allocations.length > 0 && (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {r.allocations.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{a.student.firstName} {a.student.lastName} <span className="font-mono text-muted">{a.student.indexNumber}</span></span>
                      <Badge tone={ALLOCATION_TONE[a.status]}>{ALLOCATION_LABEL[a.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <AddRoomsDialog open={adding} hostelId={hostelId} onClose={() => setAdding(false)} onDone={(m) => { setAdding(false); setNotice(m); void load(); }} />
      <EditRoomDialog room={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); setNotice('Room saved.'); void load(); }} />
      <HostelFormDialog open={editingHostel} title={`Edit ${h.name}`} initial={h} allowMixed={false} onClose={() => setEditingHostel(false)} onSave={(dto) => accommodationApi.saveHostel(dto, hostelId)} onSaved={() => { setEditingHostel(false); void load(); }} />
    </div>
  );
}

function AddRoomsDialog({ open, hostelId, onClose, onDone }: { open: boolean; hostelId: string; onClose: () => void; onDone: (message: string) => void }) {
  const [f, setF] = useState({ prefix: '', from: '101', to: '110', floor: '', capacity: '4', roomType: '4 in a room', price: '1500' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setError(null); }, [open]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const count = Math.max(0, Number(f.to) - Number(f.from) + 1);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await accommodationApi.addRooms(hostelId, { prefix: f.prefix.trim().toUpperCase(), from: Number(f.from), to: Number(f.to), floor: f.floor.trim() || undefined, capacity: Number(f.capacity), roomType: f.roomType.trim(), pricePerSemester: toPesewas(f.price) });
      onDone(`${r.added} rooms added.${r.skipped ? ` ${r.skipped} already existed.` : ''}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add rooms" description={count ? `Adds ${f.prefix.toUpperCase()}${f.from} to ${f.prefix.toUpperCase()}${f.to} (${count} rooms). Numbers that already exist are skipped.` : undefined}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Prefix" htmlFor="r-prefix"><Input id="r-prefix" maxLength={3} value={f.prefix} onChange={(e) => set('prefix', e.target.value)} placeholder="A" /></Field>
          <Field label="From" htmlFor="r-from"><Input id="r-from" type="number" inputMode="numeric" value={f.from} onChange={(e) => set('from', e.target.value)} /></Field>
          <Field label="To" htmlFor="r-to"><Input id="r-to" type="number" inputMode="numeric" value={f.to} onChange={(e) => set('to', e.target.value)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Beds per room" htmlFor="r-cap"><Input id="r-cap" type="number" inputMode="numeric" min={1} max={12} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></Field>
          <Field label="Room type" htmlFor="r-type"><Input id="r-type" value={f.roomType} maxLength={40} onChange={(e) => set('roomType', e.target.value)} /></Field>
          <Field label="Fees per semester (GH₵)" htmlFor="r-price"><Input id="r-price" type="number" inputMode="decimal" step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
          <Field label="Floor (optional)" htmlFor="r-floor"><Input id="r-floor" value={f.floor} maxLength={20} onChange={(e) => set('floor', e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!count || count > 200}>Add {count} rooms</Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditRoomDialog({ room, onClose, onDone }: { room: RoomRow | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ capacity: '', roomType: '', price: '', isActive: true, notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (room) setF({ capacity: String(room.capacity), roomType: room.roomType, price: String(room.pricePerSemester / 100), isActive: room.isActive, notes: room.notes ?? '' });
    setError(null);
  }, [room]);
  if (!room) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accommodationApi.updateRoom(room.id, { capacity: Number(f.capacity), roomType: f.roomType.trim(), pricePerSemester: toPesewas(f.price), isActive: f.isActive, notes: f.notes.trim() || undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Room ${room.number}`}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Beds" htmlFor="e-cap"><Input id="e-cap" type="number" inputMode="numeric" min={1} max={12} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
          <Field label="Room type" htmlFor="e-type"><Input id="e-type" value={f.roomType} onChange={(e) => setF({ ...f, roomType: e.target.value })} /></Field>
          <Field label="Fees (GH₵)" htmlFor="e-price"><Input id="e-price" type="number" inputMode="decimal" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        </div>
        <Field label="Notes (optional)" htmlFor="e-notes" hint="For example: ground floor, near washroom."><Input id="e-notes" value={f.notes} maxLength={200} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Available for allocation</label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Save room</Button>
        </div>
      </form>
    </Dialog>
  );
}
