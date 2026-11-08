import { useState } from 'react';
import { formatCedis } from '@anu/shared';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { StepUpPrompt } from '@/components/states/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { useStepUp } from '@/hooks/useStepUp';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';

type Purpose = 'VENDOR' | 'DISPATCHER' | 'ASSOCIATION' | 'HOSTEL_OWNER' | 'PAYROLL';

/**
 * Sends money now through a Paystack transfer to the payee's mobile money number. It is recorded only
 * when Paystack confirms it; it needs an authenticator code from the last 15 minutes.
 */
export function PayNow({ purpose, subjectId, amount, label, period, onDone }: { purpose: Purpose; subjectId: string; amount: number; label: string; period?: { from: string; to: string }; onDone: () => void }) {
  const [note, setNote] = useState<{ tone: 'success' | 'info' | 'danger'; text: string } | null>(null);
  const step = useStepUp();
  const { busy, error, run } = useSubmit();
  return (
    <>
      <FormError error={error} />
      {step.asking ? <StepUpPrompt onConfirm={step.confirm} onCancel={step.cancel} /> : null}
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <Button label={`Pay ${formatCedis(amount)} now`} loading={busy} onPress={() => void run(() => step.guard(async () => {
        const t = (await axiosInstance.post<{ status: string; failureReason: string | null }>('/payments/transfers', { purpose, subjectId, amount, periodFrom: period?.from, periodTo: period?.to })).data;
        setNote(t.status === 'SUCCEEDED' ? { tone: 'success', text: `Sent to ${label} and recorded.` } : t.status === 'PENDING' ? { tone: 'info', text: 'Sent. It is recorded when Paystack confirms, usually within minutes.' } : { tone: 'danger', text: `Not sent: ${t.failureReason ?? 'try again, or pay another way and record it'}.` });
        onDone();
      }))} />
    </>
  );
}
