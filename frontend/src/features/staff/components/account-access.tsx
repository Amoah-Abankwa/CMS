'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/axios';
import { staffApi } from '../api';

type Target = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
const COPY: Record<Target, { verb: string; description: string }> = {
  SUSPENDED: { verb: 'Suspend', description: 'They are signed out everywhere at once and cannot sign in until the account is reactivated. Use this for a lost phone, a suspected stolen password, or a disciplinary matter.' },
  DEACTIVATED: { verb: 'Deactivate', description: 'For someone who has left. They are signed out everywhere and cannot sign in. Their records and activity history are kept.' },
  ACTIVE: { verb: 'Reactivate', description: 'They can sign in again with their existing password and authenticator.' },
};

/** Suspend, deactivate or reactivate a staff or partner account. Asks for your authenticator code and is logged. */
export function AccountAccess({ member, isSelf, onChanged, save = (id, status, reason) => staffApi.setStatus(id, status, reason) }: { member: { id: string; status: string; firstName: string; lastName: string }; isSelf: boolean; onChanged: (status: string) => void; save?: (id: string, status: Target, reason: string) => Promise<{ status: string }> }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (member.status === 'PENDING_SETUP') return <p className="text-sm text-muted">The account becomes active once they complete setup.</p>;
  if (isSelf) return <p className="text-sm text-muted">Another administrator must change your own account.</p>;

  const open = (t: Target) => { setTarget(t); setReason(''); setError(null); };
  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const r = await save(member.id, target, reason.trim());
      onChanged(r.status);
      setTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {member.status === 'ACTIVE' || member.status === 'LOCKED' ? 'This account can sign in.' : member.status === 'SUSPENDED' ? 'This account is suspended and cannot sign in.' : 'This account is deactivated and cannot sign in.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {member.status !== 'SUSPENDED' && member.status !== 'DEACTIVATED' && <Button variant="secondary" size="sm" onClick={() => open('SUSPENDED')}>Suspend</Button>}
        {member.status !== 'DEACTIVATED' && <Button variant="ghost" size="sm" onClick={() => open('DEACTIVATED')}>Deactivate</Button>}
        {(member.status === 'SUSPENDED' || member.status === 'DEACTIVATED') && <Button size="sm" onClick={() => open('ACTIVE')}>Reactivate</Button>}
      </div>
      {target && (
        <Dialog open onClose={() => setTarget(null)} title={`${COPY[target].verb} ${member.firstName} ${member.lastName}?`} description={COPY[target].description}>
          <div className="flex flex-col gap-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Reason (kept in the activity log)" htmlFor="acct-reason"><Textarea id="acct-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
              <Button variant={target === 'ACTIVE' ? 'primary' : 'danger'} loading={busy} disabled={reason.trim().length < 5} onClick={submit}>{COPY[target].verb}</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
