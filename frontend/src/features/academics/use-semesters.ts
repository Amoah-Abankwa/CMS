'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/axios';
import { academicsApi, type Semester } from './api';

export function useSemesters() {
  const [semesters, setSemesters] = useState<Semester[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => academicsApi.semesters().then(setSemesters).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void reload();
  }, []);

  return { semesters, setSemesters, error, reload };
}
