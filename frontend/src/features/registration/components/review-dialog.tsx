'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { registrationApi, type ReviewItem } from '../api';

export function ReviewDialog({ item, onClose, onDecided }: { item: ReviewItem | null; onClose: () => void; onDecided: (message: string) => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    setNote('');
    setError(null);
  }, [item]);

  if (!item) return null;
  const name = fullName(item.student);
  const decidable = item.status === 'SUBMITTED';

  const decide = async (kind: 'approve' | 'reject') => {
    if (kind === 'reject' && note.trim().length < 5) return setError('Tell the student what to change before returning it.');
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'approve') await registrationApi.approve(item.id, note.trim());
      else await registrationApi.reject(item.id, note.trim());
      onDecided(kind === 'approve' ? `Approved ${name}'s registration.` : `Returned ${name}'s registration for changes.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={name}
      description={`${item.student.indexNumber}, ${item.student.studentProfile?.programme.name}, level ${item.student.studentProfile?.currentLevel}`}
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <ul className="divide-y divide-border rounded-md border border-border">
          {item.courses.map((c) => (
            <li key={c.code} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-mono">{c.code}</span> {c.title}
              </span>
              <span className="shrink-0 tabular-nums text-muted">{c.creditHours}</span>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2 text-sm font-medium">
            <span>Total credits</span>
            <span className="tabular-nums">{item.credits}</span>
          </li>
        </ul>
        {item.submittedAt && <p className="text-xs text-muted">Submitted {formatDateTime(item.submittedAt)}</p>}
        {decidable ? (
          <>
            <Field label="Note to the student" htmlFor="review-note" hint="Optional when approving. Required when returning it for changes.">
              <Textarea id="review-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" loading={busy === 'reject'} onClick={() => decide('reject')}>
                Return for changes
              </Button>
              <Button loading={busy === 'approve'} onClick={() => decide('approve')}>
                Approve
              </Button>
            </div>
          </>
        ) : (
          <Alert tone="info">
            {item.status === 'APPROVED' ? 'Approved' : 'Returned'}
            {item.reviewedBy ? ` by ${item.reviewedBy}` : ''}
            {item.reviewedAt ? ` on ${formatDateTime(item.reviewedAt)}` : ''}.{item.reviewNote ? ` Note: ${item.reviewNote}` : ''}
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
