import { useState } from 'react';
import { Image, View } from 'react-native';
import type { PrivateHostel } from '@/api/accommodation';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { useTheme } from '@/theme/useTheme';

type Photos = { photos: Array<{ publicId: string; url: string | null }>; max: number; enabled: boolean };

export default function HostelPhotos() {
  const hostels = useQuery<PrivateHostel[]>('owner.hostels', '/my-hostels');
  return (
    <Screen refreshing={hostels.loading} onRefresh={hostels.refresh}>
      <Header title="Hostel photos" subtitle="Clear photos of rooms, washrooms and the compound help students choose." />
      <QueryView q={hostels} skeleton={<SkeletonCard lines={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="No hostels yet" why="Add your hostel first; then its photos are managed here." /> : <>{list.map((h) => <HostelPhotoSet key={h.id} id={h.id} name={h.name} />)}</>}
      </QueryView>
    </Screen>
  );
}

function HostelPhotoSet({ id, name }: { id: string; name: string }) {
  const { space, radius } = useTheme();
  const q = useQuery<Photos>(`owner.photos.${id}`, `/uploads/hostels/${id}/photos`);
  const [note, setNote] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const save = (ids: string[]) => axiosInstance.put(`/uploads/hostels/${id}/photos`, { publicIds: ids });
  return (
    <QueryView q={q} skeleton={<SkeletonCard lines={2} />}>
      {(p) => (
        <Card>
          <Text variant="heading">{name}</Text>
          {!p.enabled ? <Notice tone="warning" title="Photo uploads are not set up">The university has not turned on photo storage yet.</Notice> : null}
          <FormError error={error} />
          {note ? <Text variant="small">{note}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {p.photos.map((ph) => (
              <View key={ph.publicId} style={{ gap: 4 }}>
                {ph.url ? <Image source={{ uri: ph.url }} accessibilityLabel={`Photo of ${name}`} style={{ width: 96, height: 96, borderRadius: radius.md }} /> : null}
                <Button label="Remove" variant="ghost" loading={busy} onPress={() => void run(async () => { await save(p.photos.filter((x) => x.publicId !== ph.publicId).map((x) => x.publicId)); q.refresh(); })} />
              </View>
            ))}
          </View>
          <Text variant="small" tone="muted">{p.photos.length} of {p.max} photos.</Text>
          {p.enabled && p.photos.length < p.max ? <Button label="Add a photo" variant="secondary" loading={busy} onPress={() => void run(async () => {
            try {
              const pid = await pickAndUploadImage('hostel', id);
              if (pid) { await save([...p.photos.map((x) => x.publicId), pid]); setNote('Photo added.'); q.refresh(); }
            } catch (e) { setNote(e instanceof Error ? e.message : 'The photo could not be added.'); }
          })} /> : null}
        </Card>
      )}
    </QueryView>
  );
}
