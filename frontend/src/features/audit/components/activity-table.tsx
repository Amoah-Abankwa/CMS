import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import type { AuditEntry } from '../api';
import { actionLabel } from '../labels';

/** Table on wide screens and in print; stacked rows on phones. */
export function ActivityTable({ items, showActor }: { items: AuditEntry[]; showActor?: boolean }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block print:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Time</th>
              {showActor && <th scope="col" className="px-4 py-2.5 font-medium">Person</th>}
              <th scope="col" className="px-4 py-2.5 font-medium">Activity</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Result</th>
              <th scope="col" className="px-4 py-2.5 font-medium">IP address</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(e.occurredAt)}</td>
                {showActor && (
                  <td className="px-4 py-2.5">
                    <span className="block">{e.actorLabel ?? 'Unknown account'}</span>
                    {e.actorRoleKey && <span className="block text-xs text-muted">{e.actorRoleKey.replace(/_/g, ' ')}</span>}
                  </td>
                )}
                <td className="px-4 py-2.5">{actionLabel(e.action)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={e.result === 'SUCCESS' ? 'success' : 'danger'}>{e.result === 'SUCCESS' ? 'Succeeded' : 'Failed'}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{e.ipAddress ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{e.correlationId?.slice(0, 8) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden print:hidden">
        {items.map((e) => (
          <li key={e.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{actionLabel(e.action)}</p>
              <Badge tone={e.result === 'SUCCESS' ? 'success' : 'danger'}>{e.result === 'SUCCESS' ? 'Succeeded' : 'Failed'}</Badge>
            </div>
            {showActor && <p className="mt-0.5 text-sm">{e.actorLabel ?? 'Unknown account'}</p>}
            <p className="mt-0.5 text-xs text-muted">
              {formatDateTime(e.occurredAt)}
              {e.ipAddress ? `, ${e.ipAddress}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
