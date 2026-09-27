import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import type { Semester } from '../api';

/** Short status line for a semester's course registration window. */
export function RegistrationWindow({ semester }: { semester: Semester }) {
  if (!semester.registrationOpensAt || !semester.registrationClosesAt) return <Badge>No registration window set</Badge>;
  const now = Date.now();
  if (semester.registrationOpen) return <Badge tone="success">Registration open until {formatDateTime(semester.registrationClosesAt)}</Badge>;
  if (now < new Date(semester.registrationOpensAt).getTime()) return <Badge tone="primary">Registration opens {formatDateTime(semester.registrationOpensAt)}</Badge>;
  return <Badge>Registration closed {formatDateTime(semester.registrationClosesAt)}</Badge>;
}
