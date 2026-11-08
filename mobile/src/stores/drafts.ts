import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';

/**
 * Unsent work (a half-written form), saved to the phone as it is typed. If the session expires, nothing
 * is lost: the form finds its draft again after the person signs back in.
 */
interface DraftsState {
  drafts: Record<string, { value: Record<string, unknown>; at: number }>;
  save: (key: string, value: Record<string, unknown>) => void;
  discard: (key: string) => void;
}

export const useDrafts = create<DraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      save: (key, value) => set((s) => ({ drafts: { ...s.drafts, [key]: { value, at: Date.now() } } })),
      discard: (key) =>
        set((s) => {
          const rest = { ...s.drafts };
          delete rest[key];
          return { drafts: rest };
        }),
    }),
    { name: 'anu.drafts', storage: persistStorage },
  ),
);
