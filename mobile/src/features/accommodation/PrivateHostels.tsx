import { useState } from 'react';
import { formatCedis } from '@anu/shared';
import { accommodationApi, type PrivateHostel } from '@/api/accommodation';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';

/** Verified private hostels near campus, and asking for a room. */
export function PrivateHostels({ onBooked }: { onBooked: () => void }) {
  const q = useQuery<PrivateHostel[]>('hall.private', '/me/accommodation/private');
  const { busy, error, run } = useSubmit();
  const [done, setDone] = useState<string | null>(null);
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
      {(list) => list.length === 0 ? <EmptyState title="No private hostels listed" why="Private hostels appear once the Hostels Office has verified them." /> : <>
        <FormError error={error} />
        {done ? <Text tone="success">{done}</Text> : null}
        {list.map((h) => (
          <Card key={h.id}>
            <Text variant="heading">{h.name}</Text>
            <Text variant="small" tone="muted">{[h.location, h.distanceNote].filter(Boolean).join('. ')}</Text>
            {h.facilities.length ? <Text variant="small">{h.facilities.join(', ')}</Text> : null}
            {h.roomTypes.map((r) => (
              <Button key={r.id} label={`${r.name}: ${formatCedis(r.pricePerSemester)}${r.availableBeds ? '' : ' (full)'}`} variant="secondary" disabled={!r.availableBeds} loading={busy} onPress={() => void run(async () => { await accommodationApi.book(r.id); setDone(`Asked ${h.name} for a ${r.name.toLowerCase()}. The owner replies here and by notification.`); onBooked(); })} />
            ))}
          </Card>
        ))}
      </>}
    </QueryView>
  );
}
