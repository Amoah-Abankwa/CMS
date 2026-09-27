import { create } from 'zustand';
import { applyTheme, THEME_STORAGE_KEY, ThemePreference } from '@/lib/theme';

const SIDEBAR_KEY = 'anu-sidebar-collapsed';

function read<T>(key: string, fallback: T, parse: (v: string) => T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : parse(v);
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

interface UiState {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  hydrate: () => void;
  setTheme: (theme: ThemePreference) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

/** Local UI state. Profile sync with the API lives in the preference hooks. */
export const useUiStore = create<UiState>((set) => ({
  theme: 'SYSTEM',
  sidebarCollapsed: false,
  mobileNavOpen: false,
  hydrate: () =>
    set({
      theme: read<ThemePreference>(THEME_STORAGE_KEY, 'SYSTEM', (v) => (['LIGHT', 'DARK', 'SYSTEM'].includes(v) ? (v as ThemePreference) : 'SYSTEM')),
      sidebarCollapsed: read(SIDEBAR_KEY, false, (v) => v === 'true'),
    }),
  setTheme: (theme) => {
    write(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    write(SIDEBAR_KEY, String(sidebarCollapsed));
    set({ sidebarCollapsed });
  },
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}));
