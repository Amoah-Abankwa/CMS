import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ForgotPasswordFlow } from '@/features/auth/components/forgot-password-flow';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      description="We will send a code to the email and phone on your account."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordFlow />
    </AuthLayout>
  );
}
