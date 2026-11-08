import { useCallback, useState } from 'react';
import { useDrafts } from '@/stores/drafts';

/**
 * A form's values, saved to the phone as they change. A draft survives the app closing and the session
 * expiring; call `clear()` once the form has been sent.
 */
export function useDraft<T extends Record<string, unknown>>(key: string, initial: T) {
  const saved = useDrafts((s) => s.drafts[key]?.value as T | undefined);
  const save = useDrafts((s) => s.save);
  const discard = useDrafts((s) => s.discard);
  const [value, setValue] = useState<T>(saved ?? initial);
  const restored = !!saved;
  const set = useCallback(<K extends keyof T>(k: K, v: T[K]) => {
    setValue((prev) => {
      const next = { ...prev, [k]: v };
      save(key, next);
      return next;
    });
  }, [key, save]);
  const clear = useCallback(() => { discard(key); setValue(initial); }, [discard, initial, key]);
  return { value, set, clear, restored };
}
