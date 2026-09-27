import { Badge } from '@/components/ui/badge';
import type { StaffRole } from '../api';

export function RoleList({ roles, primaryRoleKey }: { roles: StaffRole[]; primaryRoleKey?: string | null }) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={`${r.key}-${r.scope ?? ''}`} tone={r.key === primaryRoleKey ? 'primary' : 'neutral'}>
          {r.name}
          {r.scopeLabel ? `, ${r.scopeLabel}` : ''}
        </Badge>
      ))}
    </span>
  );
}
