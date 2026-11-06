'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CreateStaffForm } from '@/features/staff/components/create-staff-form';
import { RoleList } from '@/features/staff/components/role-list';
import type { StaffMember } from '@/features/staff/api';

export default function NewStaffPage() {
  const [created, setCreated] = useState<StaffMember | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
      <PageHeader title="Add a staff member" description="Creates the account and assigns roles. The person chooses their own password from the email we send." />
      <Card>
        <CardBody>
          {created ? (
            <div className="flex flex-col gap-4">
              <Alert tone="success" title="Staff account created">
                A setup link has been emailed to {created.email}. It expires in 72 hours.
              </Alert>
              <div>
                <p className="font-medium">
                  {created.firstName} {created.lastName}
                </p>
                <div className="mt-1.5">
                  <RoleList roles={created.roles} primaryRoleKey={created.primaryRoleKey} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setCreated(null);
                    setFormKey((k) => k + 1);
                  }}
                >
                  Add another
                </Button>
                <Link href={`/staff/${created.id}`} className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-muted">
                  Open their record
                </Link>
              </div>
            </div>
          ) : (
            <CreateStaffForm key={formKey} onCreated={setCreated} />
          )}
        </CardBody>
      </Card>
    </RequirePermission>
  );
}
