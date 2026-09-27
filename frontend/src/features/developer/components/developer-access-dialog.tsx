'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { developerApi, type DeveloperCandidate } from '../api';

interface Props {
  mode: 'enable' | 'disable';
  person: DeveloperCandidate | null;
  onClose: () => void;
  onDone: () => void;
}

/** Enable or disable Developer access. Both require a reason, and the API asks for a fresh MFA code. */
export function DeveloperAccessDialog({ mode, person, onClose, onDone }: Props) {
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const minReason = mode === 'enable' ? 10 : 5;

  useEffect(() => {
    setReason('');
    setExpiresAt('');
    setError(null);
  }, [person, mode]);

  if (!person) return null;
  const name = `${person.firstName} ${person.lastName}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < minReason) return setError(`Give a reason of at least ${minReason} characters.`);
    setBusy(true);
    setError(null);
    try {
      if (mode === 'enable') await developerApi.enable(person.id, reason.trim(), expiresAt ? new Date(expiresAt).toISOString() : undefined);
      else await developerApi.disable(person.id, reason.trim());
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!person}
      onClose={onClose}
      title={mode === 'enable' ? `Enable Developer access for ${name}` : `Disable Developer access for ${name}`}
      description={
        mode === 'enable'
          ? 'They will be able to switch into the Developer role and see system diagnostics. This is logged and they are notified.'
          : 'Any session working as Developer returns to their normal role immediately.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason" htmlFor="dev-reason" hint="Recorded in the activity log.">
          <Textarea id="dev-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        {mode === 'enable' && (
          <Field label="Expires (optional)" htmlFor="dev-expiry" hint="Leave empty to keep access until you disable it.">
            <Input id="dev-expiry" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={mode === 'enable' ? 'primary' : 'danger'} loading={busy}>
            {mode === 'enable' ? 'Enable access' : 'Disable access'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
