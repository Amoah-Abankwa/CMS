'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@anu/shared';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { AccountStatusBadge } from '@/components/ui/status-badge';
import { ResendSetupButton } from '@/components/ui/resend-setup-button';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { StaffRolesEditor } from '@/features/staff/components/staff-roles-editor';
import { AccountAccess } from '@/features/staff/components/account-access';
import { staffApi, type StaffMember } from '@/features/staff/api';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || '—'}</dd>
    </div>
  );
}

function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const canManageRoles = useAuthStore((s) => s.can(PERMISSIONS.ROLES_MANAGE));
  const canManageUsers = useAuthStore((s) => s.can(PERMISSIONS.USERS_MANAGE));
  const myId = useAuthStore((s) => s.me?.id);
  const [member, setMember] = useState<StaffMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    staffApi.get(id).then(setMember).catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!member) return <Spinner />;

  return (
    <>
      <PageHeader
        title={[member.staffProfile?.title, fullName(member)].filter(Boolean).join(' ')}
        description={member.email ?? undefined}
        actions={
          <Link href="/staff" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-surface-muted">
            All staff
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Account" actions={<AccountStatusBadge status={member.status} />} />
          <CardBody className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Detail label="Staff number" value={member.staffProfile?.staffNumber} />
              <Detail label="Department" value={member.staffProfile?.department?.name ?? 'Central office'} />
              <Detail label="Phone" value={member.phone} />
              <Detail label="Last sign-in" value={member.lastLoginAt ? formatDateTime(member.lastLoginAt) : 'Never'} />
            </dl>
            {member.status === 'PENDING_SETUP' && (
              <div className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">They have not set their password yet. Setup links expire after 72 hours.</p>
                {canManageUsers && <ResendSetupButton send={() => staffApi.resendSetup(member.id)} />}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Roles" description="Tick every role this person holds. Changes ask for your authenticator code and are logged." />
          <CardBody>
            <StaffRolesEditor member={member} canEdit={canManageRoles} onSaved={setMember} />
          </CardBody>
        </Card>
        {canManageUsers && (
          <Card>
            <CardHeader title="Account access" description="Suspend or deactivate this account. Asks for your authenticator code and is logged." />
            <CardBody>
              <AccountAccess member={member} isSelf={myId === member.id} onChanged={(status) => setMember({ ...member, status })} />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

export default function StaffDetailPage() {
  return (
    <RequirePermission permission={PERMISSIONS.USERS_READ}>
      <StaffDetail />
    </RequirePermission>
  );
}
