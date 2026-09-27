'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/axios';
import { auditApi, type AuditFilters } from '../api';

export function DownloadCsvButton({ scope, filters }: { scope: 'mine' | 'all'; filters: AuditFilters }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await auditApi.downloadCsv(scope, filters);
    } catch (err) {
      setError(errorMessage(err, 'The download failed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end">
      <Button variant="secondary" size="sm" loading={busy} onClick={download}>
        {!busy && <Download className="size-4" aria-hidden />} Download CSV
      </Button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}
