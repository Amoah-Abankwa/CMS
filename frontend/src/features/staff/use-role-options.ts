'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/axios';
import { staffApi, type AssignableRole, type SchoolNode } from './api';

/** Loads the role list and the school/department tree the role picker needs. */
export function useRoleOptions() {
  const [roles, setRoles] = useState<AssignableRole[] | null>(null);
  const [schools, setSchools] = useState<SchoolNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([staffApi.assignableRoles(), staffApi.structure()])
      .then(([r, s]) => {
        setRoles(r);
        setSchools(s);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return { roles, schools, error };
}
