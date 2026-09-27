'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { authApi, type SetupInfo } from '../api';
import { setupSchema } from '../schemas';

type Values = z.infer<typeof setupSchema>;

/** Opened from the welcome email. The person chooses their own password; nobody else ever knows it. */
export function SetupAccountFlow() {
  const token = useSearchParams().get('token') ?? '';
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ type: SetupInfo['type']; signInWith: string } | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(setupSchema) });

  useEffect(() => {
    if (!token) {
      setLinkError('This page needs the link from your welcome email. Open the email and select the link again.');
      return;
    }
    authApi.verifySetup(token).then(setInfo).catch((err) => setLinkError(errorMessage(err)));
  }, [token]);

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      setDone(await authApi.completeSetup(token, password));
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (linkError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{linkError}</Alert>
        <p className="text-sm text-muted">
          Lost the email or the link expired? Use{' '}
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot password
          </Link>{' '}
          with your index number or staff email and we will send a new setup link.
        </p>
      </div>
    );
  }

  if (done) {
    const student = done.type === 'STUDENT';
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="Your account is ready">
          Sign in with {student ? 'your index number' : 'your staff email'} <span className="font-mono">{done.signInWith}</span> and the password you just chose.
        </Alert>
        {!student && <p className="text-sm text-muted">Next, you will set up an authenticator app on your phone. Keep your phone with you.</p>}
        <Link
          href={student ? '/login' : '/staff/login'}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  if (!info) return <Spinner label="Checking your link" />;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">
        Welcome, {info.firstName}. You will sign in with{' '}
        <span className="font-mono font-medium">{info.signInWith}</span>.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Choose a password" htmlFor="password" hint="At least 10 characters. Avoid your name or index number." error={formState.errors.password?.message}>
        <PasswordInput id="password" autoComplete="new-password" autoFocus aria-invalid={!!formState.errors.password} {...register('password')} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={formState.errors.confirmPassword?.message}>
        <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!formState.errors.confirmPassword} {...register('confirmPassword')} />
      </Field>
      <Button type="submit" loading={formState.isSubmitting} className="w-full">
        Set password
      </Button>
    </form>
  );
}
