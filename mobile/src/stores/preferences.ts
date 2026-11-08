import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';

/** Choices kept on this phone. Lite mode loads less on slow connections. */
interface Prefs { onboarded: boolean; lite: boolean; setOnboarded: () => void; setLite: (v: boolean) => void }

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({ onboarded: false, lite: false, setOnboarded: () => set({ onboarded: true }), setLite: (lite) => set({ lite }) }),
    { name: 'anu.prefs', storage: persistStorage },
  ),
);
