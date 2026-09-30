'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import type { Semester } from '@/features/academics/api';
import type { Offering } from '@/features/offerings/api';
import { teachingApi } from '../api';

export function ClassesList() {
  const myId = useAuthStore((s) => s.me?.id);
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [data, setData] = useState<{ semester: Semester; items: Offering[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    teachingApi.classes(semesterId || undefined).then(setData).catch((err) => setError(errorMessage(err)));
  }, [semesterId]);

  return (
    <div className="flex flex-col gap-4">
      {semesters && (
        <div className="max-w-sm">
          <SemesterSelect semesters={semesters} value={semesterId} onChangeAction={setSemesterId} />
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && (
        <EmptyState title={`No classes in ${data.semester.label}`} description="When your head of department assigns you a course, it appears here and you get an email." />
      )}
      {data && data.items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((o) => {
            const others = o.lecturers.filter((l) => l.id !== myId);
            const iAmLead = o.lecturers.some((l) => l.id === myId && l.isLead);
            return (
              <li key={o.id}>
                <Link href={`/teaching/${o.id}`} className="block h-full rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary">
                  <p className="font-mono text-sm text-muted">{o.course.code}</p>
                  <p className="font-medium">{o.course.title}</p>
                  <p className="mt-2 text-sm">
                    <span className="text-2xl font-semibold tabular-nums">{o.enrolled}</span>
                    <span className="text-muted"> students{o.capacity ? ` of ${o.capacity} seats` : ''}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {o.course.creditHours} credits, level {o.course.level}. {iAmLead ? 'You are the lead lecturer.' : 'You are co-teaching.'}
                    {others.length ? ` With ${others.map((l) => l.name).join(', ')}.` : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
