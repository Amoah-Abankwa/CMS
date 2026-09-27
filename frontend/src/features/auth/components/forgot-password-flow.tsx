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
import { authApi } from '../api';
import { forgotSchema, resetSchema } from '../schemas';

export function ForgotPasswordFlow() {
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  const reset = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  const onRequest = request.handleSubmit(async (v) => {
    setError(null);
    try {
      await authApi.forgotPassword(v.identifier);
      setIdentifier(v.identifier);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  const onReset = reset.handleSubmit(async (v) => {
    setError(null);
    try {
      await authApi.resetPassword(identifier!, v.code, v.newPassword);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (done) {
    const staff = identifier?.includes('@');
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">Your password has been reset. You can now sign in.</Alert>
        <Link href={staff ? '/staff/login' : '/login'} className="text-sm font-medium text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (identifier) {
    return (
      <form onSubmit={onReset} noValidate className="flex flex-col gap-4">
        <Alert tone="info">If an account matches, we sent a 6-digit code to its email and phone. It expires in 10 minutes.</Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Code" htmlFor="code" error={reset.formState.errors.code?.message}>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" aria-invalid={!!reset.formState.errors.code} {...reset.register('code')} />
        </Field>
        <Field label="New password" htmlFor="newPassword" hint="At least 10 characters." error={reset.formState.errors.newPassword?.message}>
          <PasswordInput id="newPassword" autoComplete="new-password" aria-invalid={!!reset.formState.errors.newPassword} {...reset.register('newPassword')} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={reset.formState.errors.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!reset.formState.errors.confirmPassword} {...reset.register('confirmPassword')} />
        </Field>
        <Button type="submit" loading={reset.formState.isSubmitting} className="w-full">
          Reset password
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onRequest} noValidate className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Index number or staff email" htmlFor="identifier" error={request.formState.errors.identifier?.message}>
        <Input id="identifier" autoComplete="username" spellCheck={false} aria-invalid={!!request.formState.errors.identifier} {...request.register('identifier')} />
      </Field>
      <Button type="submit" loading={request.formState.isSubmitting} className="w-full">
        Send reset code
      </Button>
    </form>
  );
}
