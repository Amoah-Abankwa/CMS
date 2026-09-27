export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';
export const THEME_STORAGE_KEY = 'anu-theme';

export function resolveTheme(pref: ThemePreference): 'LIGHT' | 'DARK' {
  if (pref !== 'SYSTEM') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT';
}

export function applyTheme(pref: ThemePreference) {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'DARK');
}

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'SYSTEM';var d=p==='DARK'||(p==='SYSTEM'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
