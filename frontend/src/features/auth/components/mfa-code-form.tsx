'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { authApi } from '../api';
import { codeSchema } from '../schemas';
import { useCompleteSignIn } from '../use-complete-sign-in';

type Values = z.infer<typeof codeSchema>;

export function MfaCodeForm({ challengeToken, onRestart }: { challengeToken: string; onRestart: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState(false);
  const completeSignIn = useCompleteSignIn();
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(codeSchema) });

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const result = await authApi.verifyMfa(challengeToken, code);
      if (result.usedRecoveryCode) {
        setRecoveryNotice(true);
        window.setTimeout(() => void completeSignIn(), 2500);
        return;
      }
      await completeSignIn();
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {recoveryNotice && <Alert tone="warning" title="Recovery code used">Each recovery code works once. Signing you in now.</Alert>}
      <Field
        label="Authentication code"
        htmlFor="code"
        hint="Open your authenticator app and enter the 6-digit code. Lost your phone? Use a recovery code."
        error={formState.errors.code?.message}
      >
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus spellCheck={false} aria-invalid={!!formState.errors.code} {...register('code')} />
      </Field>
      <Button type="submit" loading={formState.isSubmitting} className="w-full">
        Verify and sign in
      </Button>
      <button type="button" onClick={onRestart} className="text-sm text-primary hover:underline">
        Use a different account
      </button>
    </form>
  );
}
