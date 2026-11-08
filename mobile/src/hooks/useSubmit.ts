import { useState } from 'react';
import { describeError, type Described } from '@/lib/errors';
import { useNetwork } from '@/stores/network';

/** Runs a form's request, keeping its busy state and a described error (with field errors) for the form. */
export function useSubmit() {
  const online = useNetwork((s) => s.online);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Described | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(describeError(e, online));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run, online };
}
