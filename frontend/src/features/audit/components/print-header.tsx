import { formatDateTime } from '@/lib/format';
import type { AuditFilters } from '../api';

/** Only visible on paper. Identifies whose log it is and which period it covers. */
export function PrintHeader({ title, subject, filters, total }: { title: string; subject: string; filters: AuditFilters; total: number }) {
  const period = filters.from || filters.to ? `${filters.from ?? 'start'} to ${filters.to ?? 'today'}` : 'All dates';
  return (
    <div className="mb-4 hidden border-b border-black pb-3 print:block">
      <p className="text-lg font-bold">All Nations University</p>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm">{subject}</p>
      <p className="text-sm">
        Period: {period}. Entries: {total}. Printed {formatDateTime(new Date())}.
      </p>
    </div>
  );
}
