import { useState } from 'react';
import { View } from 'react-native';
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
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

interface Resident { kind: 'allocation' | 'booking'; id: string; hostel: string; place: string; student: { firstName: string; lastName: string; indexNumber: string | null; phone: string | null }; checkedInAt: string | null; checkedOutAt: string | null }

export default function Residents() {
  const q = useQuery<{ residents: Resident[] }>('owner.residents', '/hostel-forms/residents');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Residents" subtitle="Check students in when they arrive and out when they leave." />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.residents.length === 0 ? <EmptyState title="No residents yet" why="Students appear here once you accept their booking." /> : <>{d.residents.map((r) => <ResidentCard key={`${r.kind}${r.id}`} r={r} onDone={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function ResidentCard({ r, onDone }: { r: Resident; onDone: () => void }) {
  const { space } = useTheme();
  const [note, setNote] = useState('');
  const { busy, error, run } = useSubmit();
  const action = !r.checkedInAt ? 'in' : !r.checkedOutAt ? 'out' : null;
  return (
    <Card>
      <Text variant="label">{r.student.firstName} {r.student.lastName}</Text>
      <Text variant="small" tone="muted">{r.hostel}, {r.place}{r.student.phone ? `. ${r.student.phone}` : ''}</Text>
      <Badge label={r.checkedOutAt ? 'Moved out' : r.checkedInAt ? 'Living here' : 'Not arrived yet'} tone={r.checkedOutAt ? 'neutral' : r.checkedInAt ? 'success' : 'warning'} />
      <FormError error={error} />
      {action ? (
        <View style={{ gap: space.sm }}>
          <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder={action === 'in' ? 'Key 14 given' : 'Room left clean'} />
          <Button label={action === 'in' ? 'Check in' : 'Check out'} variant="secondary" loading={busy} onPress={() => void run(async () => { await axiosInstance.post(`/hostel-forms/residents/${r.kind}/${r.id}/check`, { action, note: note.trim() || undefined }); setNote(''); onDone(); })} />
        </View>
      ) : null}
    </Card>
  );
}
