'use client';

import { useState } from 'react';
import { Button } from './button';
import { errorMessage } from '@/lib/axios';

/** Sends a fresh setup link. Older links stop working. */
export function ResendSetupButton({ send, size = 'sm' }: { send: () => Promise<unknown>; size?: 'sm' | 'md' }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setState('busy');
    setError(null);
    try {
      await send();
      setState('sent');
    } catch (err) {
      setError(errorMessage(err));
      setState('idle');
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="secondary" size={size} loading={state === 'busy'} disabled={state === 'sent'} onClick={run}>
        {state === 'sent' ? 'Setup email sent' : 'Resend setup email'}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
