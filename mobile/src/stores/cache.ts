import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';

/** The last copy of each screen's data, kept on the phone so it still shows offline. */
interface Entry { data: unknown; at: number }
interface CacheState {
  entries: Record<string, Entry>;
  put: (key: string, data: unknown) => void;
  clear: () => void;
}

export const useCache = create<CacheState>()(
  persist(
    (set) => ({
      entries: {},
      put: (key, data) => set((s) => ({ entries: { ...s.entries, [key]: { data, at: Date.now() } } })),
      clear: () => set({ entries: {} }),
    }),
    { name: 'anu.cache', storage: persistStorage },
  ),
);
