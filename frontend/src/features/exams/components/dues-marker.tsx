'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';

/** Heads of Department choose whether exam registers mark their students with unpaid compulsory dues. */
export function DuesMarker() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; showDuesOnRegister: boolean }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { api.get('/exams/dues-marker').then((r) => setRows(r.data)).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <Card>
      <CardHeader title="Unpaid dues on exam registers" description="Off by default. When on, invigilators see a marker beside your department's students who have not paid compulsory departmental dues. Nobody is stopped from sitting." />
      {error && <div className="px-4 pb-3"><Alert tone="danger">{error}</Alert></div>}
      <ul className="divide-y divide-border">
        {rows.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
            <span className="font-medium">{d.name}</span>
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={d.showDuesOnRegister} onChange={(e) => api.post(`/exams/dues-marker/${d.id}`, { on: e.target.checked }).then(load).catch((err) => setError(errorMessage(err)))} /> Show on registers</label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
