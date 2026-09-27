import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { StudentLoginForm } from '@/features/auth/components/student-login-form';

export const metadata: Metadata = { title: 'Student sign in' };

export default function StudentLoginPage() {
  return (
    <AuthLayout
      title="Student sign in"
      description="Use the index number and password from your admission message."
      footer={
        <>
          Staff member?{' '}
          <Link href="/staff/login" className="font-medium text-primary hover:underline">
            Sign in with your staff email
          </Link>
        </>
      }
    >
      <StudentLoginForm />
    </AuthLayout>
  );
}
