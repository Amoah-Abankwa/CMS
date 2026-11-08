import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

interface Ratings { average: number | null; count: number; rows: Array<{ vendorStars: number; vendorComment: string | null; createdAt: string; order: { number: number } }> }

export default function VendorRatings() {
  const q = useQuery<Ratings>('vendor.ratings', '/vendor/ratings');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Ratings" />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(r) => r.count === 0 ? <EmptyState title="No ratings yet" why="Customers can rate an order after it is completed. Ratings show to students as an average." /> : (
          <>
            <Card>
              <Text variant="title">{r.average?.toFixed(1)} of 5</Text>
              <Text variant="small" tone="muted">From {r.count} ratings. Students see the average, not who rated.</Text>
            </Card>
            {r.rows.map((x, i) => (
              <Card key={i} style={{ padding: 12 }}>
                <Text variant="label">{x.vendorStars} of 5 stars, order {x.order.number}</Text>
                {x.vendorComment ? <Text>{x.vendorComment}</Text> : null}
                <Text variant="small" tone="muted">{new Date(x.createdAt).toLocaleDateString()}</Text>
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
