'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { authApi } from '../api';
import { changePasswordSchema } from '../schemas';

type Values = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm({ onChanged }: { onChanged?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState, reset } = useForm<Values>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setDone(false);
    try {
      await authApi.changePassword(v.currentPassword, v.newPassword);
      reset();
      setDone(true);
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {done && <Alert tone="success">Password changed. Other devices have been signed out.</Alert>}
      <Field label="Current password" htmlFor="currentPassword" error={formState.errors.currentPassword?.message}>
        <PasswordInput id="currentPassword" autoComplete="current-password" aria-invalid={!!formState.errors.currentPassword} {...register('currentPassword')} />
      </Field>
      <Field label="New password" htmlFor="newPassword" hint="At least 10 characters. Avoid your name or index number." error={formState.errors.newPassword?.message}>
        <PasswordInput id="newPassword" autoComplete="new-password" aria-invalid={!!formState.errors.newPassword} {...register('newPassword')} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={formState.errors.confirmPassword?.message}>
        <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!formState.errors.confirmPassword} {...register('confirmPassword')} />
      </Field>
      <div>
        <Button type="submit" loading={formState.isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}
