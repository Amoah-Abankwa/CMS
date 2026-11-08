import type { ReactNode } from 'react';
import { describeError, offlineError } from '@/lib/errors';
import { SkeletonCard } from '../ui/Skeleton';
import { Text } from '../ui/Text';
import { ErrorState } from './ErrorState';
import { SlowNetworkNotice } from './SlowNetworkNotice';
import type { Progress } from '@/hooks/useQuery';

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * The states every loaded screen needs, in one place: the shape of the content while loading (no
 * spinner), the saved copy while offline or refreshing, real progress and a lighter path when slow,
 * and a clear error when there is nothing saved to show.
 */
export function QueryView<T>({ q, skeleton, children }: {
  q: { data: T | undefined; savedAt: number | null; loading: boolean; error: unknown; slow: boolean; progress: Progress | null; online: boolean; refresh: () => void; useSaved: () => void };
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const slow = q.slow ? <SlowNetworkNotice progress={q.progress} lighter={q.data ? { label: `Show the copy saved at ${time(q.savedAt!)}`, onPress: q.useSaved } : { label: 'Stop and try later', onPress: q.useSaved }} /> : null;
  if (q.data === undefined) {
    if (q.error) return <ErrorState error={describeError(q.error, q.online)} onRetry={q.refresh} />;
    if (!q.online) return <ErrorState error={offlineError()} onRetry={q.refresh} />;
    return <>{slow}{skeleton ?? <><SkeletonCard /><SkeletonCard lines={2} /></>}</>;
  }
  return (
    <>
      {slow}
      {q.savedAt && (!q.online || q.error) ? <Text variant="small" tone="muted">Showing the copy saved at {time(q.savedAt)}.</Text> : null}
      {children(q.data)}
    </>
  );
}
