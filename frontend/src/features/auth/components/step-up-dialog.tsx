'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useStepUpStore } from '@/stores/step-up.store';
import { errorMessage } from '@/lib/axios';
import { authApi } from '../api';

/** Shown automatically when a sensitive action needs a fresh authenticator code. */
export function StepUpDialog() {
  const open = useStepUpStore((s) => s.open);
  const settle = useStepUpStore((s) => s.settle);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (confirmed: boolean) => {
    setCode('');
    setError(null);
    settle(confirmed);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from your authenticator app.');
    setBusy(true);
    setError(null);
    try {
      await authApi.stepUp(code);
      close(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => close(false)} title="Confirm it is you" description="This action needs a fresh code from your authenticator app.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="6-digit code" htmlFor="step-up-code">
          <Input id="step-up-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.trim())} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Confirm
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
