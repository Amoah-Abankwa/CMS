import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { SetupAccountFlow } from '@/features/auth/components/setup-account-flow';
import { Spinner } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Set up your account',
  // The link contains a one-time token; never leak it to other sites through the Referer header.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function SetupAccountPage() {
  return (
    <AuthLayout title="Set up your account" description="Choose the password you will use to sign in.">
      <Suspense fallback={<Spinner />}>
        <SetupAccountFlow />
      </Suspense>
    </AuthLayout>
  );
}
