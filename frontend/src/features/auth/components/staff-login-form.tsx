'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { authApi, type StaffPasswordResult } from '../api';
import { staffLoginSchema } from '../schemas';
import { MfaCodeForm } from './mfa-code-form';
import { MfaEnrolment } from './mfa-enrolment';

type Values = z.infer<typeof staffLoginSchema>;

/** Step 1: email and password. Step 2: MFA (or first-time MFA setup). There is no way to skip step 2. */
export function StaffLoginForm({ onStepChange }: { onStepChange?: (step: 'password' | 'mfa' | 'enrol') => void }) {
  const [challenge, setChallenge] = useState<StaffPasswordResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, reset } = useForm<Values>({ resolver: zodResolver(staffLoginSchema) });

  const restart = () => {
    setChallenge(null);
    reset();
    onStepChange?.('password');
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await authApi.staffLogin(values.email, values.password);
      setChallenge(result);
      onStepChange?.(result.status === 'mfa_required' ? 'mfa' : 'enrol');
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (challenge?.status === 'mfa_required') return <MfaCodeForm challengeToken={challenge.challengeToken} onRestart={restart} />;
  if (challenge?.status === 'mfa_enrolment_required') return <MfaEnrolment challengeToken={challenge.challengeToken} onRestart={restart} />;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Staff email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="username" placeholder="name@anu.edu.gh" aria-invalid={!!formState.errors.email} {...register('email')} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
      </Field>
      <Button type="submit" loading={formState.isSubmitting} className="mt-1 w-full">
        Continue
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-primary hover:underline">
        Forgot your password?
      </Link>
    </form>
  );
}
