'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { registrationApi, type MyRegistration } from '@/features/registration/api';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'primary' | 'success' | 'danger' }> = {
  DRAFT: { label: 'Saved, not submitted', tone: 'neutral' },
  SUBMITTED: { label: 'Waiting for approval', tone: 'primary' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Returned for changes', tone: 'danger' },
};

/** Student dashboard card: where their course registration stands this semester. */
export function RegistrationCard() {
  const [data, setData] = useState<MyRegistration | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    registrationApi.mine().then(setData).catch(() => setFailed(true));
  }, []);

  if (failed || !data) return null;
  const status = data.registration?.status;
  const s = status ? STATUS[status] : { label: data.semester.registrationOpen ? 'Not started' : 'Not registered', tone: 'neutral' as const };

  return (
    <Card>
      <CardHeader
        title="Course registration"
        description={data.semester.label}
        actions={
          <Link href="/registration" className="text-sm text-primary hover:underline">
            {data.semester.registrationOpen && status !== 'APPROVED' ? 'Open registration' : 'View'}
          </Link>
        }
      />
      <CardBody className="flex flex-wrap items-center gap-3">
        <Badge tone={s.tone}>{s.label}</Badge>
        <span className="text-sm text-muted">
          {data.registration ? `${data.registration.offeringIds.length} courses chosen.` : `${data.available.length} courses offered for your level.`}
        </span>
      </CardBody>
    </Card>
  );
}
