'use client';

import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { SessionsList } from '@/features/auth/components/sessions-list';
import { ProfilePhoto } from '@/features/auth/components/profile-photo';

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account and security" />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Profile photo" description="Shown beside your name on the platform." />
          <CardBody>
            <ProfilePhoto />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Password" description="Changing your password signs you out on other devices." />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Where you are signed in" description="Sign out any device you do not recognise, then change your password." />
          <CardBody className="py-0">
            <SessionsList />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
