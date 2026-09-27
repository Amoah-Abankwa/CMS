'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { auditApi, type AuditFilters } from '@/features/audit/api';
import { useAuditList } from '@/features/audit/use-audit-list';
import { ActivityFilters } from '@/features/audit/components/activity-filters';
import { ActivityTable } from '@/features/audit/components/activity-table';
import { PrintHeader } from '@/features/audit/components/print-header';
import { DownloadCsvButton } from '@/features/audit/components/download-csv-button';

export default function MyActivityPage() {
  const me = useAuthStore((s) => s.me);
  const [filters, setFilters] = useState<AuditFilters>({});
  const { data, error, loading, page, setPage } = useAuditList(auditApi.mine, filters);

  return (
    <>
      <PageHeader
        title="My activity"
        description="Every sign-in, change and action on your account. Print or download it for your records."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print
            </Button>
            <DownloadCsvButton scope="mine" filters={filters} />
          </>
        }
      />
      <PrintHeader title="Account activity log" subject={`${me?.firstName} ${me?.lastName}, ${me?.indexNumber ?? me?.email}`} filters={filters} total={data?.total ?? 0} />
      <div className="flex flex-col gap-4">
        <ActivityFilters value={filters} onChange={setFilters} />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="rounded-lg border border-border bg-surface print:border-0">
          {loading && !data ? (
            <Spinner />
          ) : data && data.items.length === 0 ? (
            <EmptyState title="No activity for these filters" />
          ) : data ? (
            <>
              <ActivityTable items={data.items} />
              <div className="border-t border-border px-4 py-3">
                <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
