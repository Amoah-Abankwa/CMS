'use client';

import { useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { accommodationApi, BOOKING_LABEL, BOOKING_TONE, GENDER_LABEL, toPesewas, type OwnerBooking, type PrivateHostel, type RoomType } from '../api';
import { HostelFormDialog } from './hostel-form';

const VERIFICATION = {
  PENDING: { tone: 'warning', text: 'Waiting for the Hostel Office to verify. Students cannot see it yet.' },
  APPROVED: { tone: 'success', text: 'Verified. Students can see it and ask for beds.' },
  REJECTED: { tone: 'danger', text: 'Not approved.' },
  SUSPENDED: { tone: 'danger', text: 'Suspended. Hidden from students.' },
} as const;

/** A private hostel owner's page: their listings, room types and booking requests. */
export function MyHostel() {
  const [hostels, setHostels] = useState<PrivateHostel[] | null>(null);
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [status, setStatus] = useState('REQUESTED');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<PrivateHostel | 'new' | null>(null);
  const [roomType, setRoomType] = useState<{ hostelId: string; rt?: RoomType } | null>(null);
  const [answering, setAnswering] = useState<{ booking: OwnerBooking; accept: boolean } | null>(null);

  const load = () => {
    accommodationApi.myHostels().then(setHostels).catch((err) => setError(errorMessage(err)));
    accommodationApi.ownerBookings(status || undefined).then(setBookings).catch(() => setBookings([]));
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hostels && !error) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader title="Booking requests" actions={
          <Select aria-label="Show" className="h-9 w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="REQUESTED">Waiting for you</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="">All</option>
          </Select>
        } />
        {bookings.length === 0 ? <EmptyState title={status === 'REQUESTED' ? 'No requests waiting' : 'Nothing here yet'} /> : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{b.student.firstName} {b.student.lastName}</span> <span className="font-mono text-xs text-muted">{b.student.indexNumber}</span>
                  <span className="block text-xs text-muted">{b.roomType.hostel.name}, {b.roomType.name}. {b.student.phone}, {b.student.email}. Asked {formatDateTime(b.createdAt)}.</span>
                  {b.message && <span className="block text-xs">Message: {b.message}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={BOOKING_TONE[b.status]}>{b.status === 'REQUESTED' ? 'Waiting' : BOOKING_LABEL[b.status]}</Badge>
                  {b.status === 'REQUESTED' && (
                    <>
                      <Button size="sm" onClick={() => setAnswering({ booking: b, accept: true })}>Accept</Button>
                      <Button variant="secondary" size="sm" onClick={() => setAnswering({ booking: b, accept: false })}>Decline</Button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Your hostels</h2>
        <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>List a hostel</Button>
      </div>
      {hostels?.length === 0 && <EmptyState title="No hostels listed" description="List your hostel. The Hostel Office verifies it before students can see it." />}
      {hostels?.map((h) => {
        const v = VERIFICATION[h.verification ?? 'PENDING'];
        return (
          <Card key={h.id}>
            <CardHeader title={h.name} description={`${GENDER_LABEL[h.gender]} students. ${h.location ?? ''}`} actions={<Button variant="ghost" size="sm" onClick={() => setEditing(h)}>Edit</Button>} />
            <CardBody className="flex flex-col gap-3">
              <Alert tone={v.tone}>{v.text}{h.verificationNote ? ` ${h.verificationNote}` : ''}</Alert>
              <ul className="divide-y divide-border rounded-md border border-border">
                {h.roomTypes.map((rt) => (
                  <li key={rt.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{rt.name}, {formatCedis(rt.pricePerSemester)} per semester <span className="block text-xs text-muted">{rt.availableBeds} beds free{rt.isActive === false ? '. Hidden' : ''}</span></span>
                    <Button variant="ghost" size="sm" onClick={() => setRoomType({ hostelId: h.id, rt })}>Edit</Button>
                  </li>
                ))}
              </ul>
              <div><Button variant="secondary" size="sm" onClick={() => setRoomType({ hostelId: h.id })}>Add a room type</Button></div>
            </CardBody>
          </Card>
        );
      })}

      <HostelFormDialog
        open={!!editing}
        title={editing === 'new' ? 'List a hostel' : `Edit ${editing?.name ?? ''}`}
        initial={editing && editing !== 'new' ? { ...editing, location: editing.location ?? undefined, digitalAddress: editing.digitalAddress ?? undefined, distanceNote: editing.distanceNote ?? undefined, description: editing.description ?? undefined, contactPhone: editing.contactPhone ?? undefined } : { gender: 'MIXED' }}
        allowMixed
        onClose={() => setEditing(null)}
        onSave={(dto) => accommodationApi.saveMyHostel(dto, editing && editing !== 'new' ? editing.id : undefined)}
        onSaved={() => { setNotice(editing === 'new' ? 'Hostel listed. The Hostel Office will verify it.' : 'Hostel saved.'); setEditing(null); load(); }}
      />
      <RoomTypeDialog target={roomType} onClose={() => setRoomType(null)} onDone={() => { setRoomType(null); setNotice('Room type saved.'); load(); }} />
      <AnswerDialog target={answering} onClose={() => setAnswering(null)} onDone={(m) => { setAnswering(null); setNotice(m); load(); }} />
    </div>
  );
}

function RoomTypeDialog({ target, onClose, onDone }: { target: { hostelId: string; rt?: RoomType } | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', bedsPerRoom: '2', price: '', availableBeds: '', description: '', isActive: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const rt = target?.rt;
    setF({ name: rt?.name ?? '', bedsPerRoom: String(rt?.bedsPerRoom ?? 2), price: rt ? String(rt.pricePerSemester / 100) : '', availableBeds: String(rt?.availableBeds ?? ''), description: rt?.description ?? '', isActive: rt?.isActive ?? true });
    setError(null);
  }, [target]);
  if (!target) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accommodationApi.saveRoomType(target.hostelId, { name: f.name.trim(), bedsPerRoom: Number(f.bedsPerRoom), pricePerSemester: toPesewas(f.price), availableBeds: Number(f.availableBeds), description: f.description.trim() || null, isActive: f.isActive }, target.rt?.id);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={target.rt ? `Edit ${target.rt.name}` : 'Add a room type'}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Name" htmlFor="rt-name" hint="For example: 2 in a room, self-contained."><Input id="rt-name" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Beds per room" htmlFor="rt-beds"><Input id="rt-beds" type="number" inputMode="numeric" min={1} max={12} value={f.bedsPerRoom} onChange={(e) => setF({ ...f, bedsPerRoom: e.target.value })} /></Field>
          <Field label="Price per semester (GH₵)" htmlFor="rt-price"><Input id="rt-price" type="number" inputMode="decimal" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Beds free now" htmlFor="rt-free"><Input id="rt-free" type="number" inputMode="numeric" min={0} value={f.availableBeds} onChange={(e) => setF({ ...f, availableBeds: e.target.value })} /></Field>
        </div>
        <Field label="Description (optional)" htmlFor="rt-desc"><Textarea id="rt-desc" value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Show to students</label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={f.name.trim().length < 3 || f.price === '' || f.availableBeds === ''}>Save room type</Button>
        </div>
      </form>
    </Dialog>
  );
}

function AnswerDialog({ target, onClose, onDone }: { target: { booking: OwnerBooking; accept: boolean } | null; onClose: () => void; onDone: (m: string) => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(''); setError(null); }, [target]);
  if (!target) return null;
  const { booking, accept } = target;
  const save = async () => {
    setBusy(true);
    try {
      await accommodationApi.respondBooking(booking.id, accept, note.trim() || undefined);
      onDone(accept ? `Accepted. ${booking.student.firstName} has been told to contact you about payment.` : 'Declined. The student has been told.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`${accept ? 'Accept' : 'Decline'} ${booking.student.firstName} ${booking.student.lastName}?`} description={`${booking.roomType.name}. ${booking.roomType.availableBeds} beds free.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Note to the student (optional)" htmlFor="ans-note" hint={accept ? 'For example: when to come and how to pay.' : undefined}>
          <Textarea id="ans-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={accept ? 'primary' : 'danger'} loading={busy} onClick={save}>{accept ? 'Accept' : 'Decline'}</Button>
        </div>
      </div>
    </Dialog>
  );
}
