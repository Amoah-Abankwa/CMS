/** Where the backend and website are (set in .env as EXPO_PUBLIC_*). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://portal.anu.edu.gh';
/** After this long, a request counts as slow and the screen offers a lighter path. */
export const SLOW_AFTER_MS = 4000;
