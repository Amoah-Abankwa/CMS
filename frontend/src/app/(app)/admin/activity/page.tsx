'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { LOG_GROUP_LABELS, PERMISSIONS, type LogGroup } from '@anu/shared';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { auditApi, type AuditFilters, type GroupSummary as Summary } from '@/features/audit/api';
import { useAuditList } from '@/features/audit/use-audit-list';
import { ActivityFilters } from '@/features/audit/components/activity-filters';
import { ActivityTable } from '@/features/audit/components/activity-table';
import { GroupSummary } from '@/features/audit/components/group-summary';
import { PrintHeader } from '@/features/audit/components/print-header';
import { DownloadCsvButton } from '@/features/audit/components/download-csv-button';

function AllActivity() {
  const canExport = useAuthStore((s) => s.can(PERMISSIONS.AUDIT_EXPORT));
  const [filters, setFilters] = useState<AuditFilters>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const { data, error, loading, page, setPage } = useAuditList(auditApi.all, filters);

  useEffect(() => {
    auditApi.groups(filters).then(setSummary).catch(() => setSummary(null));
  }, [filters.from, filters.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupLabel = filters.group ? LOG_GROUP_LABELS[filters.group as LogGroup] : 'All user groups';

  return (
    <>
      <PageHeader
        title="All activity"
        description="Activity across every account, grouped by who performed it."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print
            </Button>
            {canExport && (
              <DownloadCsvButton scope="all" filters={filters} />
            )}
          </>
        }
      />
      <PrintHeader title={`Activity log: ${groupLabel}`} subject="Prepared from the Super Admin console" filters={filters} total={data?.total ?? 0} />
      <div className="flex flex-col gap-4">
        {summary && <GroupSummary summary={summary} active={filters.group} onSelect={(group) => setFilters((f) => ({ ...f, group }))} />}
        <ActivityFilters key={filters.group ?? 'all'} value={filters} onChange={setFilters} admin />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="rounded-lg border border-border bg-surface print:border-0">
          {loading && !data ? (
            <Spinner />
          ) : data && data.items.length === 0 ? (
            <EmptyState title="No activity for these filters" />
          ) : data ? (
            <>
              <ActivityTable items={data.items} showActor />
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

export default function AdminActivityPage() {
  return (
    <RequirePermission permission={PERMISSIONS.AUDIT_READ_ALL}>
      <AllActivity />
    </RequirePermission>
  );
}
