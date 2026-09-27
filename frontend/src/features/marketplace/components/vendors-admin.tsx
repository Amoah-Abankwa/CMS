'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { foodApi, type AdminVendor } from '../api';

const STATUS_TONE = { PENDING: 'warning', APPROVED: 'success', SUSPENDED: 'danger', REJECTED: 'neutral' } as const;
type Decision = 'APPROVED' | 'SUSPENDED' | 'REJECTED';

export function VendorsAdmin() {
  const [vendors, setVendors] = useState<AdminVendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<{ vendor: AdminVendor; status: Decision } | null>(null);
  const load = () => foodApi.adminVendors().then(setVendors).catch((err) => setError(errorMessage(err)));
  useEffect(() => { void load(); }, []);

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Card>
        <CardHeader title="Vendors" description="Only approved vendors are shown to students and staff." actions={<Button size="sm" onClick={() => setCreating(true)}>Add vendor</Button>} />
        {!vendors ? <CardBody><Spinner /></CardBody> : vendors.length === 0 ? <CardBody><EmptyState title="No vendors yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {vendors.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="min-w-0 text-sm">
                  <span className="flex items-center gap-2 font-medium">{v.name} <Badge tone={STATUS_TONE[v.status]}>{v.status.toLowerCase()}</Badge>{v.paused && <Badge>paused</Badge>}</span>
                  <span className="block text-xs text-muted">{v.location}. {v.owner.firstName} {v.owner.lastName}, {v.owner.email}{v.owner.status === 'PENDING_SETUP' ? ' (has not set up their account yet)' : ''}</span>
                  <span className="block text-xs text-muted">{v.menuItems} dishes. {v.ordersLast30Days} orders completed in the last 30 days. Payout: {v.payoutNumber ? `${v.payoutNetwork} ${v.payoutNumber}` : 'not set'}.</span>
                  {v.statusNote && <span className="block text-xs text-muted">Note: {v.statusNote}</span>}
                </span>
                <span className="flex shrink-0 flex-wrap gap-2">
                  {v.status !== 'APPROVED' && <Button size="sm" onClick={() => setReviewing({ vendor: v, status: 'APPROVED' })}>Approve</Button>}
                  {v.status === 'APPROVED' && <Button variant="secondary" size="sm" onClick={() => setReviewing({ vendor: v, status: 'SUSPENDED' })}>Suspend</Button>}
                  {v.status === 'PENDING' && <Button variant="ghost" size="sm" onClick={() => setReviewing({ vendor: v, status: 'REJECTED' })}>Reject</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <SettingsCard />
      <CreateVendorDialog open={creating} onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />
      <ReviewDialog target={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); void load(); }} />
    </div>
  );
}

function SettingsCard() {
  const [s, setS] = useState<{ commissionPercent: string; unpaidMinutes: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { foodApi.settings().then((x) => setS({ commissionPercent: String(x.commissionPercent), unpaidMinutes: String(x.unpaidMinutes) })).catch(() => undefined); }, []);
  if (!s) return null;
  const save = async () => {
    try {
      await foodApi.saveSettings({ commissionPercent: Number(s.commissionPercent), unpaidMinutes: Number(s.unpaidMinutes) });
      setMsg({ tone: 'success', text: 'Saved. Commission applies to new orders.' });
    } catch (err) {
      setMsg({ tone: 'danger', text: errorMessage(err) });
    }
  };
  return (
    <Card>
      <CardHeader title="Marketplace settings" />
      <CardBody className="flex flex-col gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="University commission on online orders (%)" htmlFor="m-comm" hint="0 to 30. Taken before paying vendors."><Input id="m-comm" type="number" min={0} max={30} value={s.commissionPercent} onChange={(e) => setS({ ...s, commissionPercent: e.target.value })} /></Field>
          <Field label="Cancel unpaid orders after (minutes)" htmlFor="m-unpaid" hint="10 to 120."><Input id="m-unpaid" type="number" min={10} max={120} value={s.unpaidMinutes} onChange={(e) => setS({ ...s, unpaidMinutes: e.target.value })} /></Field>
        </div>
        <div><Button variant="secondary" onClick={save}>Save settings</Button></div>
      </CardBody>
    </Card>
  );
}

function CreateVendorDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const empty = { firstName: '', lastName: '', email: '', phone: '', vendorName: '', location: '' };
  const [f, setF] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(empty); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await foodApi.createVendor(f);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const input = (k: keyof typeof f, label: string, type = 'text') => (
    <Field label={label} htmlFor={`v-${k}`}><Input id={`v-${k}`} type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
  );
  return (
    <Dialog open={open} onClose={onClose} title="Add vendor" description="The owner gets an email to set a password and authenticator. The shop stays hidden until you approve it.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          {input('vendorName', 'Shop name')}
          {input('location', 'Location on campus')}
          {input('firstName', "Owner's first name")}
          {input('lastName', "Owner's last name")}
          {input('email', "Owner's email", 'email')}
          {input('phone', "Owner's phone", 'tel')}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={Object.values(f).some((x) => !x.trim())} onClick={save}>Add vendor</Button>
        </div>
      </div>
    </Dialog>
  );
}

function ReviewDialog({ target, onClose, onDone }: { target: { vendor: AdminVendor; status: Decision } | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(''); setError(null); }, [target]);
  if (!target) return null;
  const { vendor, status } = target;
  const verb = { APPROVED: 'Approve', SUSPENDED: 'Suspend', REJECTED: 'Reject' }[status];
  const submit = async () => {
    setBusy(true);
    try {
      await foodApi.review(vendor.id, status, note.trim() || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`${verb} ${vendor.name}?`}
      description={status === 'APPROVED' ? 'The shop becomes visible and can take orders in its opening hours.' : status === 'SUSPENDED' ? 'The shop is hidden at once. Orders already placed can still be finished.' : 'The shop will not be listed.'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={status === 'APPROVED' ? 'Note to the owner (optional)' : 'Reason (sent to the owner)'} htmlFor="rev-note"><Textarea id="rev-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={status === 'APPROVED' ? 'primary' : 'danger'} loading={busy} disabled={status !== 'APPROVED' && note.trim().length < 3} onClick={submit}>{verb}</Button>
        </div>
      </div>
    </Dialog>
  );
}
