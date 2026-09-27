'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { AccountStatusBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/lib/axios';
import { fullName } from '@/lib/format';
import { staffApi, type AssignableRole, type StaffMember } from '../api';
import { RoleList } from './role-list';

const PAGE_SIZE = 20;

export function StaffList() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [data, setData] = useState<{ items: StaffMember[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    staffApi.assignableRoles().then(setRoles).catch(() => setRoles([]));
  }, []);

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
    staffApi
      .list({ page, pageSize: PAGE_SIZE, search: query || undefined, roleKey: roleKey || undefined, status: status || undefined })
      .then((d) => active && setData(d))
      .catch((err) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [page, query, roleKey, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="staff-search" className="sr-only">
            Search staff
          </label>
          <Input id="staff-search" type="search" placeholder="Search name, email or staff number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label htmlFor="staff-role" className="sr-only">
            Filter by role
          </label>
          <Select id="staff-role" value={roleKey} onChange={(e) => { setRoleKey(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="staff-status" className="sr-only">
            Filter by status
          </label>
          <Select id="staff-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Any status</option>
            <option value="PENDING_SETUP">Awaiting setup</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && <EmptyState title="No staff match these filters" />}
      {data && data.items.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Staff number</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Department</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Roles</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="px-4 py-2.5">
                      <Link href={`/staff/${m.id}`} className="font-medium text-primary hover:underline">
                        {[m.staffProfile?.title, fullName(m)].filter(Boolean).join(' ')}
                      </Link>
                      <span className="block text-xs text-muted">{m.email}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{m.staffProfile?.staffNumber}</td>
                    <td className="px-4 py-2.5 text-muted">{m.staffProfile?.department?.name ?? 'Central office'}</td>
                    <td className="px-4 py-2.5">
                      <RoleList roles={m.roles} primaryRoleKey={m.primaryRoleKey} />
                    </td>
                    <td className="px-4 py-2.5">
                      <AccountStatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-border md:hidden">
            {data.items.map((m) => (
              <li key={m.id}>
                <Link href={`/staff/${m.id}`} className="block px-4 py-3 hover:bg-surface-muted">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{fullName(m)}</span>
                    <AccountStatusBadge status={m.status} />
                  </span>
                  <span className="mb-1.5 block text-xs text-muted">{m.email}</span>
                  <RoleList roles={m.roles} primaryRoleKey={m.primaryRoleKey} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
