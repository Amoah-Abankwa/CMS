import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';

interface Row { id: string; vendorStars: number; vendorComment: string | null; createdAt: string; hiddenAt: string | null; name: string; order: { number: number; vendor: { name: string } } }

export default function FoodRatings() {
  const q = useQuery<Row[]>('mkt.ratings', '/marketplace/ratings');
  const { busy, error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Food ratings" subtitle="Hide a rating that is abusive or not about the order. Hidden ratings do not count." />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(list) => list.length === 0 ? <EmptyState title="No ratings yet" why="Ratings appear after students rate completed orders." /> : <>{list.map((r) => (
          <Card key={r.id} style={{ padding: 10 }}>
            <Text variant="label">{r.vendorStars} of 5 stars for {r.order.vendor.name}, order {r.order.number}</Text>
            <Text variant="small" tone="muted">{r.name}, {new Date(r.createdAt).toLocaleDateString()}</Text>
            {r.vendorComment ? <Text>{r.vendorComment}</Text> : null}
            {r.hiddenAt ? <Badge label="Hidden" /> : null}
            <Button label={r.hiddenAt ? 'Show again' : 'Hide'} variant="ghost" loading={busy} onPress={() => void run(async () => { await axiosInstance.post(`/marketplace/ratings/${r.id}/hide`, { paused: !r.hiddenAt }); q.refresh(); })} />
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
