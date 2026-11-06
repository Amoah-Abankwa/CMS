'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { registrationApi, type MyRegistration } from '@/features/registration/api';

const REG: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'primary' }> = {
  APPROVED: { label: 'Approved', tone: 'success' }, SUBMITTED: { label: 'Waiting for approval', tone: 'warning' }, DRAFT: { label: 'Not submitted', tone: 'neutral' }, REJECTED: { label: 'Returned for changes', tone: 'danger' },
};

/** The student's details at a glance: who they are, where they are in the programme, and registration. */
export function StudentDetails() {
  const me = useAuthStore((s) => s.me);
  const [reg, setReg] = useState<MyRegistration | null>(null);
  useEffect(() => { registrationApi.mine().then(setReg).catch(() => undefined); }, []);
  if (!me) return null;
  const status = reg?.registration?.status;
  const rows: Array<[string, React.ReactNode]> = [
    ['Index number', me.indexNumber ?? ''],
    ['Programme', reg?.profile.programme.name ?? ''],
    ['Department', reg?.profile.department ?? ''],
    ['Level', reg ? String(reg.profile.level) : ''],
    ['Academic year', reg?.semester.academicYear?.label ?? ''],
    ['Current semester', reg?.semester.label ?? ''],
    ['Course registration', status ? <Badge tone={REG[status]?.tone ?? 'neutral'}>{REG[status]?.label ?? status}</Badge> : <Badge>Not started</Badge>],
  ];
  return (
    <Card>
      <CardHeader title={`${me.firstName} ${me.lastName}`} description="Your details this term." />
      <CardBody>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border pb-1 sm:block sm:border-0 sm:pb-0">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v || '-'}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
