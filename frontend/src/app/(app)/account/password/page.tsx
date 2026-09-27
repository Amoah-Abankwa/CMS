'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { authApi } from '@/features/auth/api';

/** First sign-in: the temporary password must be replaced before anything else. */
export default function ForcedPasswordChangePage() {
  const me = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const router = useRouter();

  return (
    <>
      <PageHeader title="Set your password" />
      <Card>
        <CardBody className="flex flex-col gap-4">
          {me?.mustChangePassword && <Alert tone="info">You signed in with a temporary password. Choose your own to continue.</Alert>}
          <ChangePasswordForm
            onChanged={async () => {
              setMe(await authApi.me());
              router.replace('/dashboard');
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
