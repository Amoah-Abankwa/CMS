'use client';

import { useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/axios';

type Purpose = 'VENDOR' | 'DISPATCHER' | 'ASSOCIATION' | 'HOSTEL_OWNER' | 'PAYROLL';

/**
 * Sends a payout through Paystack Transfers to the payee's mobile money number. The payout is recorded
 * only when Paystack confirms it; otherwise nothing changes. Asks for an authenticator code if needed.
 */
export function PayNowButton({ purpose, subjectId, amount, label, period, onDone }: { purpose: Purpose; subjectId: string; amount: number; label: string; period?: { from: string; to: string }; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const send = async () => {
    if (!window.confirm(`Send ${formatCedis(amount)} to ${label} now through Paystack? The money leaves the university's Paystack balance.`)) return;
    setBusy(true);
    setNote(null);
    try {
      const t = (await api.post<{ status: string; failureReason: string | null }>('/payments/transfers', { purpose, subjectId, amount, periodFrom: period?.from, periodTo: period?.to })).data;
      setNote(t.status === 'SUCCEEDED' ? 'Sent and recorded.' : t.status === 'PENDING' ? 'Sent; it is recorded when Paystack confirms.' : `Failed: ${t.failureReason ?? 'try again or pay by hand'}.`);
      onDone();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" loading={busy} onClick={send}>Pay now</Button>
      {note && <span className="text-xs text-muted">{note}</span>}
    </span>
  );
}
