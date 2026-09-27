import { Badge } from './badge';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PENDING_SETUP: { label: 'Awaiting setup', tone: 'warning' },
  ACTIVE: { label: 'Active', tone: 'success' },
  LOCKED: { label: 'Locked', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  DEACTIVATED: { label: 'Deactivated', tone: 'neutral' },
};

export function AccountStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
