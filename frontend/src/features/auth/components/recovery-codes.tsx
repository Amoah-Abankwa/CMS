'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useCompleteSignIn } from '../use-complete-sign-in';

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const completeSignIn = useCompleteSignIn();

  const copy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning" title="Save your recovery codes">
        Each code signs you in once if you lose your phone. This is the only time they are shown.
      </Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-muted p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Print codes
        </Button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-4" />I have stored these codes somewhere safe.
      </label>
      <Button
        disabled={!saved}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await completeSignIn();
        }}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
