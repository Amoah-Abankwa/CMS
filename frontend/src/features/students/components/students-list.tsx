'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AccountStatusBadge } from '@/components/ui/status-badge';
import { ResendSetupButton } from '@/components/ui/resend-setup-button';
import { useAuthStore } from '@/stores/auth.store';
import { PERMISSIONS } from '@anu/shared';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { fullName } from '@/lib/format';
import { studentsApi, type StudentRow } from '../api';
import { AccountAccess } from '@/features/staff/components/account-access';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

const PAGE_SIZE = 20;

export function StudentsList() {
  const [account, setAccount] = useState<StudentRow | null>(null);
  const canRegister = useAuthStore((st) => st.can(PERMISSIONS.STUDENTS_REGISTER));
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: StudentRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wait until typing pauses before searching.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let active = true;
    setError(null);
    studentsApi
      .list({ page, pageSize: PAGE_SIZE, search: query || undefined })
      .then((d) => active && setData(d))
      .catch((err) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [page, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <label htmlFor="student-search" className="sr-only">
          Search students
        </label>
        <Input id="student-search" type="search" placeholder="Search by name, index number or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && <EmptyState title="No students found" description={query ? 'Try a different name or index number.' : 'Registered students appear here.'} />}
      {data && data.items.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Index number</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Programme</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Admitted</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Level</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-mono">{s.indexNumber}</td>
                    <td className="px-4 py-2.5">
                      {fullName(s)} {s.isDemo && <Badge>Demo</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{s.studentProfile?.programme.name}</td>
                    <td className="px-4 py-2.5 text-muted">{s.studentProfile?.admissionYear}</td>
                    <td className="px-4 py-2.5 text-muted">{s.studentProfile?.currentLevel}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-col items-start gap-1.5">
                        <AccountStatusBadge status={s.status} />
                        {s.status === 'PENDING_SETUP' && canRegister && <ResendSetupButton send={() => studentsApi.resendSetup(s.id)} />}
                        {canRegister && s.status !== 'PENDING_SETUP' && <Button variant="ghost" size="sm" onClick={() => setAccount(s)}>Account</Button>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-border md:hidden">
            {data.items.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm">{s.indexNumber}</span>
                  <AccountStatusBadge status={s.status} />
                </p>
                <p className="text-sm font-medium">{fullName(s)}</p>
                <p className="text-xs text-muted">
                  {s.studentProfile?.programme.name}, level {s.studentProfile?.currentLevel}
                </p>
                {s.status === 'PENDING_SETUP' && canRegister && (
                  <div className="mt-2">
                    <ResendSetupButton send={() => studentsApi.resendSetup(s.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        </div>
      )}
      {account && (
        <Dialog open onClose={() => setAccount(null)} title={`${account.firstName} ${account.lastName}`} description={`${account.indexNumber}. Suspending signs them out everywhere; their records are kept.`}>
          <AccountAccess member={account} isSelf={false} save={studentsApi.setStatus} onChanged={(status) => { setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === account.id ? { ...x, status } : x)) } : d)); setAccount(null); }} />
        </Dialog>
      )}
    </div>
  );
}
