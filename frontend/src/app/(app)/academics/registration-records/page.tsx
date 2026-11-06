'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RegistrationRecords } from '@/features/registration/components/registration-records';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.REGISTRATION_RECORDS_READ}>
      <PageHeader title="Registration records" description="Dropped courses, rejected registrations, rejected drop requests and exam malpractice cases." />
      <RegistrationRecords />
    </RequirePermission>
  );
}
