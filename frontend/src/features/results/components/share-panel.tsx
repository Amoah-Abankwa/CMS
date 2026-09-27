'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { resultsApi, type Workbook } from '../api';

/**
 * Continuous assessment reaches students only when the lead lecturer shares it.
 * Each share sends students an email, SMS and in-app alert (without the marks themselves).
 */
export function SharePanel({ workbook, dirty, onChanged, onError }: { workbook: Workbook; dirty: boolean; onChanged: (w: Workbook) => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const ca = workbook.assessments.filter((a) => a.kind === 'CONTINUOUS');
  if (!workbook.isLead || ca.length === 0) return null;

  const share = async (id: string) => {
    setBusy(id);
    try {
      onChanged(await resultsApi.share(workbook.offering.id, id));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface px-4 py-3">
      <h3 className="text-sm font-semibold">Share continuous assessment with students</h3>
      <p className="mt-0.5 text-xs text-muted">Students see a mark only after you share it. Exam marks reach them when results are published.</p>
      <ul className="mt-3 divide-y divide-border">
        {ca.map((a) => {
          const changed = !!a.marksUpdatedAt && (!a.releasedAt || new Date(a.marksUpdatedAt) > new Date(a.releasedAt));
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm">
                {a.name}{' '}
                {a.releasedAt ? (
                  changed ? <Badge tone="warning">Changed since shared</Badge> : <Badge tone="success">Shared {formatDateTime(a.releasedAt)}</Badge>
                ) : (
                  <Badge>Not shared</Badge>
                )}
              </span>
              <Button variant="secondary" size="sm" loading={busy === a.id} disabled={!changed || dirty} title={dirty ? 'Save your marks first' : undefined} onClick={() => share(a.id)}>
                {a.releasedAt ? 'Share update' : 'Share with students'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
