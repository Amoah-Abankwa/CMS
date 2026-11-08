import { useState } from 'react';
import { View } from 'react-native';
import { ILL_STATUS_LABEL, type IllStatus } from '@anu/shared';
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

interface Ill { id: string; title: string; authors: string | null; status: IllStatus; dueDate: string | null; librarianNote: string | null; createdAt: string; requester?: { firstName: string; lastName: string; indexNumber: string | null; phone: string | null } }
const NEXT: Partial<Record<IllStatus, IllStatus[]>> = { REQUESTED: ['ORDERED', 'REJECTED'], ORDERED: ['ARRIVED', 'REJECTED'], ARRIVED: ['ON_LOAN'], ON_LOAN: ['RETURNED'] };

export default function InterLibraryLoans() {
  const q = useQuery<Ill[]>('lib.ill', '/library/ill');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Inter-library loans" subtitle="Books borrowers asked for from partner libraries." />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(list) => list.length === 0 ? <EmptyState title="No requests" why="Requests borrowers make appear here." /> : <>{list.map((r) => <IllCard key={r.id} r={r} onDone={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function IllCard({ r, onDone }: { r: Ill; onDone: () => void }) {
  const { space } = useTheme();
  const [to, setTo] = useState<IllStatus | null>(null);
  const [extra, setExtra] = useState({ dueDate: '', note: '' });
  const { busy, error, run } = useSubmit();
  const needsDate = to === 'ON_LOAN';
  const needsNote = to === 'REJECTED';
  const ok = (!needsDate || /^\d{4}-\d{2}-\d{2}$/.test(extra.dueDate)) && (!needsNote || extra.note.trim().length >= 5);
  return (
    <Card>
      <Text variant="label">{r.title}{r.authors ? `, ${r.authors}` : ''}</Text>
      {r.requester ? <Text variant="small" tone="muted">{r.requester.firstName} {r.requester.lastName} ({r.requester.indexNumber ?? 'staff'}){r.requester.phone ? `, ${r.requester.phone}` : ''}</Text> : null}
      <Badge label={ILL_STATUS_LABEL[r.status]} />
      <FormError error={error} />
      {to ? (
        <View style={{ gap: space.sm }}>
          {needsDate ? <TextField label="Due back" value={extra.dueDate} placeholder="YYYY-MM-DD" onChangeText={(x) => setExtra({ ...extra, dueDate: x })} /> : null}
          <TextField label={needsNote ? 'Why it is not possible (they see this)' : 'Note (optional)'} value={extra.note} onChangeText={(x) => setExtra({ ...extra, note: x })} />
          <Button label={ILL_STATUS_LABEL[to]} disabled={!ok} loading={busy} onPress={() => void run(async () => { await axiosInstance.post(`/library/ill/${r.id}/move`, { status: to, dueDate: needsDate ? extra.dueDate : undefined, note: extra.note.trim() || undefined }); setTo(null); onDone(); })} />
          <Button label="Cancel" variant="ghost" onPress={() => setTo(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(NEXT[r.status] ?? []).map((s) => <Button key={s} label={ILL_STATUS_LABEL[s]} variant={s === 'REJECTED' ? 'ghost' : 'secondary'} onPress={() => setTo(s)} />)}</View>
      )}
    </Card>
  );
}
