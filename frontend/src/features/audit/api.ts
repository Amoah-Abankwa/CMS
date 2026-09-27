import { api } from '@/lib/axios';

export interface AuditEntry {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorLabel: string | null;
  actorRoleKey: string | null;
  logGroup: string | null;
  action: string;
  module: string;
  targetType: string | null;
  targetId: string | null;
  result: 'SUCCESS' | 'FAILURE';
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: unknown;
}

export interface AuditFilters {
  from?: string;
  to?: string;
  search?: string;
  module?: string;
  group?: string;
  result?: 'SUCCESS' | 'FAILURE';
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GroupSummary {
  groups: Array<{ group: string; label: string; count: number }>;
  unattributed: number;
}

function clean(filters: AuditFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
}

/** Converts yyyy-mm-dd inputs to a full-day range in UTC. */
export function toRange(filters: AuditFilters): AuditFilters {
  return {
    ...filters,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  };
}

export const auditApi = {
  mine: (filters: AuditFilters, page: number, pageSize = 25) =>
    api.get<AuditPage>('/audit/me', { params: { ...clean(toRange(filters)), page, pageSize } }).then((r) => r.data),
  all: (filters: AuditFilters, page: number, pageSize = 25) =>
    api.get<AuditPage>('/audit', { params: { ...clean(toRange(filters)), page, pageSize } }).then((r) => r.data),
  groups: (filters: AuditFilters) =>
    api.get<GroupSummary>('/audit/groups', { params: clean({ from: toRange(filters).from, to: toRange(filters).to }) }).then((r) => r.data),
  /** Downloads through the shared client so an expired session is refreshed first. */
  downloadCsv: async (scope: 'mine' | 'all', filters: AuditFilters) => {
    const path = scope === 'mine' ? '/audit/me/export.csv' : '/audit/export.csv';
    const res = await api.get<Blob>(path, { params: clean(toRange(filters)), responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = scope === 'mine' ? 'my-activity.csv' : 'activity-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
