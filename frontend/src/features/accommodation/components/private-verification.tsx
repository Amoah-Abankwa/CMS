'use client';

import { useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { AccountStatusBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/lib/axios';
import { accommodationApi, GENDER_LABEL, type PrivateHostel } from '../api';

const TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', SUSPENDED: 'danger' } as const;
type Owners = Awaited<ReturnType<typeof accommodationApi.owners>>;

/** Check private hostels before students can see them, and create accounts for their owners. */
export function PrivateVerification() {
  const [hostels, setHostels] = useState<PrivateHostel[] | null>(null);
  const [owners, setOwners] = useState<Owners>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ hostel: PrivateHostel; status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' } | null>(null);
  const [note, setNote] = useState('');
  const [addingOwner, setAddingOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    accommodationApi.privateHostels().then(setHostels).catch((err) => setError(errorMessage(err)));
    accommodationApi.owners().then(setOwners).catch(() => setOwners([]));
  };
  useEffect(load, []);

  const decide = async () => {
    if (!deciding) return;
    setBusy(true);
    try {
      await accommodationApi.verify(deciding.hostel.id, deciding.status, note.trim() || undefined);
      setNotice(`${deciding.hostel.name}: ${deciding.status.toLowerCase()}. The owner has been told.`);
      setDeciding(null);
      setNote('');
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!hostels && !error) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Visit or call before approving. Students see only approved hostels, and a hostel can be suspended at any time if complaints come in.</p>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {hostels?.length === 0 && <EmptyState title="No private hostels listed yet" />}
      {hostels?.map((h) => (
        <Card key={h.id}>
          <CardHeader
            title={h.name}
            description={[GENDER_LABEL[h.gender] + ' students', h.location, h.digitalAddress, h.distanceNote].filter(Boolean).join('. ')}
            actions={<Badge tone={TONE[h.verification ?? 'PENDING']}>{(h.verification ?? 'PENDING').toLowerCase()}</Badge>}
          />
          <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
            {h.owner && <p className="text-sm">Owner: {h.owner.firstName} {h.owner.lastName}, {h.owner.phone}, {h.owner.email}</p>}
            {h.description && <p className="text-sm text-muted">{h.description}</p>}
            <ul className="text-sm">
              {h.roomTypes.map((rt) => <li key={rt.name}>{rt.name}: {formatCedis(rt.pricePerSemester)}, {rt.availableBeds} beds free</li>)}
            </ul>
            {h.verificationNote && <p className="text-xs text-muted">Last note: {h.verificationNote}</p>}
            <div className="flex flex-wrap gap-2">
              {h.verification !== 'APPROVED' && <Button size="sm" onClick={() => setDeciding({ hostel: h, status: 'APPROVED' })}>Approve</Button>}
              {h.verification === 'PENDING' && <Button variant="secondary" size="sm" onClick={() => setDeciding({ hostel: h, status: 'REJECTED' })}>Reject</Button>}
              {h.verification === 'APPROVED' && <Button variant="secondary" size="sm" onClick={() => setDeciding({ hostel: h, status: 'SUSPENDED' })}>Suspend</Button>}
            </div>
          </div>
        </Card>
      ))}

      <Card>
        <CardHeader title="Hostel owners" actions={<Button size="sm" onClick={() => setAddingOwner(true)}>Add an owner</Button>} />
        {owners.length === 0 ? <EmptyState title="No owners yet" /> : (
          <ul className="divide-y divide-border">
            {owners.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span>{o.firstName} {o.lastName} <span className="block text-xs text-muted">{o.email}, {o.phone}. {o.ownedHostels.map((h) => h.name).join(', ') || 'No hostels listed yet'}</span></span>
                <AccountStatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!deciding} onClose={() => setDeciding(null)} title={deciding ? `${{ APPROVED: 'Approve', REJECTED: 'Reject', SUSPENDED: 'Suspend' }[deciding.status]} ${deciding.hostel.name}?` : ''}>
        <div className="flex flex-col gap-4">
          <Field label={deciding?.status === 'APPROVED' ? 'Note to the owner (optional)' : 'Reason, sent to the owner'} htmlFor="verify-note">
            <Textarea id="verify-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button variant={deciding?.status === 'APPROVED' ? 'primary' : 'danger'} loading={busy} disabled={deciding?.status !== 'APPROVED' && note.trim().length < 5} onClick={decide}>Confirm</Button>
          </div>
        </div>
      </Dialog>
      <OwnerDialog open={addingOwner} onClose={() => setAddingOwner(false)} onDone={() => { setAddingOwner(false); setNotice('Owner account created. A setup link has been emailed.'); load(); }} />
    </div>
  );
}

function OwnerDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ firstName: '', lastName: '', email: '', phone: '' }); setError(null); } }, [open]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accommodationApi.createOwner(f);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a private hostel owner" description="They get an email to set a password, then sign in with an authenticator app like staff.">
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" htmlFor="o-first"><Input id="o-first" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label="Surname" htmlFor="o-last"><Input id="o-last" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          <Field label="Email" htmlFor="o-email"><Input id="o-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone" htmlFor="o-phone"><Input id="o-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!f.firstName || !f.lastName || !f.email || !f.phone}>Create account</Button>
        </div>
      </form>
    </Dialog>
  );
}
