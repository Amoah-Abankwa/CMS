'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { examsApi, type EligibilityPaper } from '../api';

export function OverrideDialog({ paper, studentLabel, onClose, onDone }: { paper: EligibilityPaper | null; studentLabel: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReason('');
    setError(null);
  }, [paper]);

  if (!paper) return null;
  const target = paper.status === 'ELIGIBLE' ? 'NOT_ELIGIBLE' : 'ELIGIBLE';

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`${paper.offering.course.code} for ${studentLabel}`} description={`The rules say ${paper.ruleStatus === 'ELIGIBLE' ? 'eligible' : 'not eligible'}.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {paper.override ? (
          <>
            <Alert tone="info">
              Overridden to {paper.override.status === 'ELIGIBLE' ? 'eligible' : 'not eligible'}. Reason: {paper.override.reason}
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button loading={busy} onClick={() => run(() => examsApi.clearOverride(paper.id))}>
                Remove override
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Reason" htmlFor="override-reason" hint="Recorded in the activity log. Students only see &ldquo;Decision of the Examinations Office&rdquo;.">
              <Textarea id="override-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant={target === 'NOT_ELIGIBLE' ? 'danger' : 'primary'} loading={busy} disabled={reason.trim().length < 5} onClick={() => run(() => examsApi.override(paper.id, target, reason.trim()))}>
                Mark as {target === 'ELIGIBLE' ? 'eligible' : 'not eligible'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
