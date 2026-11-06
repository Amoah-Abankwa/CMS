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

export function MfaCodeForm({ challengeToken, onRestart, onEnrolInstead }: { challengeToken: string; onRestart: () => void; onEnrolInstead?: (enrolToken: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState<{ sentTo: string } | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState(false);
  const completeSignIn = useCompleteSignIn();
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(codeSchema) });

  // After every hook: React needs the same hooks on every render.
  if (emailMode && onEnrolInstead) return <EmailCodeForm challengeToken={challengeToken} sentTo={emailMode.sentTo} onBack={() => setEmailMode(null)} onVerified={onEnrolInstead} />;

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
      {onEnrolInstead && (
        <button type="button" className="text-sm text-primary hover:underline" onClick={() => { setError(null); authApi.sendMfaEmail(challengeToken).then(setEmailMode).catch((err) => setError(errorMessage(err))); }}>
          Can&apos;t use your authenticator? Email me a code
        </button>
      )}
      <button type="button" onClick={onRestart} className="text-sm text-primary hover:underline">
        Use a different account
      </button>
    </form>
  );
}

/** Signing in with an emailed code; afterwards the person sets up a new authenticator. */
function EmailCodeForm({ challengeToken, sentTo, onBack, onVerified }: { challengeToken: string; sentTo: string; onBack: () => void; onVerified: (enrolToken: string) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await authApi.verifyMfaEmail(challengeToken, code);
      onVerified(r.challengeToken);
    } catch (err) {
      setMsg({ tone: 'danger', text: errorMessage(err) });
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate className="flex flex-col gap-4">
      <Alert tone="info">We emailed a 6-digit code to {sentTo}. It expires in 10 minutes. After you enter it, your old authenticator is removed and you set up a new one.</Alert>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Field label="Code from the email" htmlFor="email-code">
        <Input id="email-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </Field>
      <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">Continue</Button>
      <button type="button" className="text-sm text-primary hover:underline" onClick={() => authApi.sendMfaEmail(challengeToken).then(() => setMsg({ tone: 'success', text: 'A new code is on its way. Use the latest email.' })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }))}>Send a new code</button>
      <button type="button" className="text-sm text-primary hover:underline" onClick={onBack}>Use my authenticator after all</button>
    </form>
  );
}