import { useState } from 'react';
import { isAxiosError } from 'axios';
import { axiosInstance } from '@/lib/api';

/**
 * Some actions (suspending an account, resetting an authenticator) need the authenticator confirmed in
 * the last 15 minutes. `guard(fn)` runs fn; if the server asks for that, it keeps fn waiting until
 * `confirm(code)` succeeds, then runs it again.
 */
export function useStepUp() {
  const [pending, setPending] = useState<null | (() => Promise<void>)>(null);
  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if (isAxiosError(e) && (e.response?.data as { code?: string } | undefined)?.code === 'STEP_UP_REQUIRED') { setPending(() => fn); return; }
      throw e;
    }
  };
  const confirm = async (code: string) => {
    await axiosInstance.post('/auth/mfa/step-up', { code: code.trim() });
    const fn = pending;
    setPending(null);
    if (fn) await fn();
  };
  return { asking: !!pending, guard, confirm, cancel: () => setPending(null) };
}
