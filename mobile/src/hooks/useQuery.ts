import { useCallback, useEffect, useRef, useState } from 'react';
import { axiosInstance } from '@/lib/api';
import { SLOW_AFTER_MS } from '@/lib/config';
import { useCache } from '@/stores/cache';
import { useNetwork } from '@/stores/network';

export interface Progress { loaded: number; total: number | null; elapsedMs: number }

/**
 * Loads `path` and keeps the last copy on the phone under `key`. While loading, the saved copy (if any)
 * stays on screen. After SLOW_AFTER_MS the request is marked slow and its real download progress is
 * reported, so the screen can offer a lighter path: `useSaved()` stops waiting and keeps the saved copy.
 */
export function useQuery<T>(key: string, path: string, params?: Record<string, unknown>) {
  const online = useNetwork((s) => s.online);
  const cached = useCache((s) => s.entries[key]);
  const put = useCache((s) => s.put);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [slow, setSlow] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const abort = useRef<AbortController | null>(null);
  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const started = Date.now();
    setLoading(true);
    setError(null);
    setSlow(false);
    setProgress(null);
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    try {
      const r = await axiosInstance.get<T>(path, {
        params: JSON.parse(paramsKey),
        signal: controller.signal,
        onDownloadProgress: (e) => setProgress({ loaded: e.loaded, total: e.total ?? null, elapsedMs: Date.now() - started }),
      });
      put(key, r.data);
    } catch (e) {
      if (!controller.signal.aborted) setError(e);
    } finally {
      clearTimeout(timer);
      if (abort.current === controller) {
        setLoading(false);
        setSlow(false);
      }
    }
  }, [key, path, paramsKey, put]);

  useEffect(() => {
    if (online) void load();
    return () => abort.current?.abort();
  }, [load, online]);

  /** The lighter path on a slow connection: stop waiting and keep showing the saved copy. */
  const useSaved = useCallback(() => {
    abort.current?.abort();
    setLoading(false);
    setSlow(false);
  }, []);

  return { data: cached?.data as T | undefined, savedAt: cached?.at ?? null, loading, error, slow, progress, online, refresh: load, useSaved };
}
