'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { authApi, type Enrolment } from '../api';
import { totpSchema } from '../schemas';
import { RecoveryCodes } from './recovery-codes';

type Values = z.infer<typeof totpSchema>;

/** Mandatory first-time setup of an authenticator app for staff accounts. */
export function MfaEnrolment({ challengeToken, onRestart }: { challengeToken: string; onRestart: () => void }) {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(totpSchema) });

  useEffect(() => {
    authApi.startEnrolment(challengeToken).then(setEnrolment).catch((err) => setError(errorMessage(err)));
  }, [challengeToken]);

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const result = await authApi.confirmEnrolment(challengeToken, code);
      setRecoveryCodes(result.recoveryCodes ?? []);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (recoveryCodes) return <RecoveryCodes codes={recoveryCodes} />;
  if (!enrolment && !error) return <Spinner label="Preparing setup" />;

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {enrolment && (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Install an authenticator app such as Google Authenticator or Microsoft Authenticator.</li>
            <li>Scan this code with the app.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex justify-center rounded-md border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolment.qrDataUrl} alt="QR code to add your account to an authenticator app" width={180} height={180} />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-primary">Cannot scan? Enter the key manually</summary>
            <code className="mt-2 block break-all rounded bg-surface-muted px-2 py-1.5 text-xs">{enrolment.manualKey}</code>
          </details>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Field label="6-digit code" htmlFor="code" error={formState.errors.code?.message}>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" aria-invalid={!!formState.errors.code} {...register('code')} />
            </Field>
            <Button type="submit" loading={formState.isSubmitting} className="w-full">
              Turn on two-step verification
            </Button>
          </form>
        </>
      )}
      <button type="button" onClick={onRestart} className="text-sm text-primary hover:underline">
        Start again
      </button>
    </div>
  );
}
