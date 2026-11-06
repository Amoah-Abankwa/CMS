'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import type { Semester } from '@/features/academics/api';
import { accommodationApi, GENDER_LABEL, type UniversityHostel } from '../api';
import { HostelFormDialog } from './hostel-form';

export function HostelsOverview() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [data, setData] = useState<{ semester: Semester; items: UniversityHostel[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => accommodationApi.university(semesterId || undefined).then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const totals = data.items.reduce((t, h) => ({ beds: t.beds + h.beds, accepted: t.accepted + h.accepted, offered: t.offered + h.offered, free: t.free + h.free }), { beds: 0, accepted: 0, offered: 0, free: 0 });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {semesters && <div className="sm:w-80"><SemesterSelect semesters={semesters} value={semesterId} onChange={setSemesterId} /></div>}
        <Button size="sm" onClick={() => setAdding(true)}>Add a hostel</Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Beds', totals.beds], ['Accepted', totals.accepted], ['Offered, awaiting reply', totals.offered], ['Free', totals.free]].map(([l, n]) => (
          <div key={l} className="rounded-lg border border-border bg-surface px-4 py-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-2xl font-semibold tabular-nums">{n}</dd></div>
        ))}
      </dl>
      {data.items.length === 0 ? (
        <EmptyState title="No university hostels yet" action={<Button onClick={() => setAdding(true)}>Add a hostel</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((h) => {
            const used = h.beds ? Math.round(((h.accepted + h.offered + h.provisional) / h.beds) * 100) : 0;
            return (
              <li key={h.id}>
                <Link href={`/hostels/${h.id}`} className="block rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-medium">{h.name}</span>
                    <span className="flex gap-1.5"><Badge>{GENDER_LABEL[h.gender]}</Badge>{!h.isActive && <Badge tone="warning">Closed</Badge>}</span>
                  </span>
                  <span className="block text-xs text-muted">{h.location}{h.roomTypes.length ? `. ${h.roomTypes.join(', ')}` : ''}</span>
                  <span className="mt-3 block h-2 rounded-sm bg-surface-muted" aria-hidden><span className="block h-2 rounded-sm bg-primary" style={{ width: `${used}%` }} /></span>
                  <span className="mt-1.5 block text-xs text-muted">
                    {h.rooms} rooms, {h.beds} beds. {h.accepted} accepted, {h.offered} offered{h.provisional ? `, ${h.provisional} provisional` : ''}, {h.free} free.
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <HostelFormDialog open={adding} title="Add a university hostel" allowMixed={false} onClose={() => setAdding(false)} onSave={(dto) => accommodationApi.saveHostel(dto)} onSaved={() => { setAdding(false); void load(); }} />
    </div>
  );
}
