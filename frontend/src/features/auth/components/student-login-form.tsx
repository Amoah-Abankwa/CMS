'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { authApi } from '../api';
import { studentLoginSchema } from '../schemas';
import { useCompleteSignIn } from '../use-complete-sign-in';
import { Input } from '@/components/ui/input';

type Values = z.infer<typeof studentLoginSchema>;

export function StudentLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const completeSignIn = useCompleteSignIn();
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(studentLoginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await authApi.studentLogin(values.indexNumber, values.password);
      await completeSignIn();
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Index number" htmlFor="indexNumber" error={formState.errors.indexNumber?.message}>
        <Input
          id="indexNumber"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ANU25400001"
          aria-invalid={!!formState.errors.indexNumber}
          {...register('indexNumber')}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
      </Field>
      <Button type="submit" loading={formState.isSubmitting} className="mt-1 w-full">
        Sign in
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-primary hover:underline">
        Forgot your password?
      </Link>
    </form>
  );
}
