import type { SectionItem } from './sections';
import type { Me } from '@/stores/auth';

/** The website's menu rule: the active role's permissions, and the kind of account. */
export function canSee(item: SectionItem, me: Me | null) {
  if (!me) return false;
  if (item.audience === 'STUDENT' && me.type !== 'STUDENT') return false;
  if (item.audience === 'STAFF' && me.type !== 'STAFF') return false;
  if (item.audience === 'MEMBER' && me.type === 'PARTNER') return false;
  if (item.permission && !me.permissions.includes(item.permission)) return false;
  if (item.anyPermission && !item.anyPermission.some((p) => me.permissions.includes(p))) return false;
  return true;
}
