'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/axios';
import type { AuditFilters, AuditPage } from './api';

export function useAuditList(fetcher: (f: AuditFilters, page: number) => Promise<AuditPage>, filters: AuditFilters) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(filters);

  useEffect(() => setPage(1), [key]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetcher(JSON.parse(key), page)
      .then((d) => active && setData(d))
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fetcher, key, page]);

  return { data, error, loading, page, setPage };
}
