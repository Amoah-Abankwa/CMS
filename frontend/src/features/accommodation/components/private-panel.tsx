'use client';

import { useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { accommodationApi, BOOKING_LABEL, BOOKING_TONE, GENDER_LABEL, type MyAccommodation, type PrivateHostel, type RoomType } from '../api';

/** Verified private hostels, booking requests and the student's own bookings. */
export function PrivatePanel({ data, onChange }: { data: MyAccommodation; onChange: () => void }) {
  const [hostels, setHostels] = useState<PrivateHostel[] | null>(null);
  const [requesting, setRequesting] = useState<{ hostel: PrivateHostel; roomType: RoomType } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => accommodationApi.browsePrivate().then(setHostels).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, []);

  const request = async () => {
    if (!requesting) return;
    setBusy('request');
    setError(null);
    try {
      await accommodationApi.book(requesting.roomType.id, message.trim() || undefined);
      setNotice(`Request sent to ${requesting.hostel.name}. You will be told when the owner replies.`);
      setRequesting(null);
      setMessage('');
      onChange();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await accommodationApi.cancelBooking(id);
      setNotice('Booking cancelled.');
      onChange();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const active = data.bookings.filter((b) => b.status === 'REQUESTED' || b.status === 'ACCEPTED');

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        Only hostels verified by the Hostel Office are listed. Agree payment with the hostel directly and pay only the hostel, never a third party.
      </Alert>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {data.bookings.length > 0 && (
        <Card>
          <CardHeader title="Your requests" />
          <ul className="divide-y divide-border">
            {data.bookings.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="text-sm">
                  <span className="font-medium">{b.roomType.hostel.name}</span>, {b.roomType.name}. {formatCedis(b.roomType.pricePerSemester)}.
                  {b.ownerNote && <span className="block text-xs text-muted">Owner: {b.ownerNote}</span>}
                  {b.status === 'ACCEPTED' && b.roomType.hostel.contactPhone && <span className="block text-xs text-muted">Contact the hostel on {b.roomType.hostel.contactPhone}.</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={BOOKING_TONE[b.status]}>{BOOKING_LABEL[b.status]}</Badge>
                  {(b.status === 'REQUESTED' || b.status === 'ACCEPTED') && <Button variant="ghost" size="sm" loading={busy === b.id} onClick={() => cancel(b.id)}>Cancel</Button>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!hostels && !error && <Spinner />}
      {hostels?.length === 0 && <EmptyState title="No verified private hostels listed yet" />}
      {hostels?.map((h) => (
        <Card key={h.id}>
          <CardHeader title={h.name} description={[h.location, h.distanceNote].filter(Boolean).join('. ')} actions={<Badge>{GENDER_LABEL[h.gender]}</Badge>} />
          <CardBody className="flex flex-col gap-3">
            {h.photoUrls && h.photoUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {h.photoUrls.map((u, i) => <img key={u} src={u} alt={`${h.name} photo ${i + 1}`} className="h-36 w-52 shrink-0 rounded-md border border-border object-cover" />)}
              </div>
            )}
            {h.description && <p className="text-sm">{h.description}</p>}
            {h.facilities.length > 0 && <p className="text-xs text-muted">{h.facilities.join(', ')}</p>}
            <ul className="divide-y divide-border rounded-md border border-border">
              {h.roomTypes.map((rt) => {
                const requested = active.some((b) => b.roomType.name === rt.name && b.roomType.hostel.name === h.name);
                return (
                  <li key={rt.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">
                      <span className="font-medium">{rt.name}</span>, {formatCedis(rt.pricePerSemester)} per semester
                      <span className="block text-xs text-muted">{rt.availableBeds > 0 ? `${rt.availableBeds} beds free` : 'Full'}{rt.description ? `. ${rt.description}` : ''}</span>
                    </span>
                    <Button size="sm" variant="secondary" disabled={rt.availableBeds < 1 || requested || data.residence.kind === 'UNIVERSITY' || data.residence.kind === 'PRIVATE'} onClick={() => setRequesting({ hostel: h, roomType: rt })}>
                      {requested ? 'Requested' : 'Ask for a bed'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ))}

      <Dialog open={!!requesting} onClose={() => setRequesting(null)} title={requesting ? `Ask ${requesting.hostel.name} for a bed` : ''} description={requesting ? `${requesting.roomType.name}, ${formatCedis(requesting.roomType.pricePerSemester)} per semester` : ''}>
        <div className="flex flex-col gap-4">
          <Field label="Message to the owner (optional)" htmlFor="book-msg" hint="The owner sees your name, index number, phone and email so they can contact you.">
            <Textarea id="book-msg" value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRequesting(null)}>Cancel</Button>
            <Button loading={busy === 'request'} onClick={request}>Send request</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
