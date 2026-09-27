'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { StaffLoginForm } from '@/features/auth/components/staff-login-form';

const COPY = {
  password: { title: 'Staff and partner sign in', description: 'Staff and partner accounts use two-step verification.' },
  mfa: { title: 'Enter your code', description: 'Check your authenticator app.' },
  enrol: { title: 'Set up two-step verification', description: 'Required once for every staff account.' },
};

export default function StaffLoginPage() {
  const [step, setStep] = useState<keyof typeof COPY>('password');
  return (
    <AuthLayout
      title={COPY[step].title}
      description={COPY[step].description}
      footer={
        step === 'password' && (
          <>
            Student?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in with your index number
            </Link>
          </>
        )
      }
    >
      <StaffLoginForm onStepChange={setStep} />
    </AuthLayout>
  );
}
