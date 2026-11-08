import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

type Status = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
interface Complaint { id: string; category: string; description: string; status: Status; officeNote: string | null; ownerResponse: string | null; createdAt: string; hostel: { name: string }; student: { firstName: string; lastName: string; indexNumber?: string | null } | null }
const LABEL: Record<Status, string> = { OPEN: 'New', IN_REVIEW: 'In review', RESOLVED: 'Resolved', DISMISSED: 'Dismissed' };

export default function OfficeComplaints() {
  const { space } = useTheme();
  const [status, setStatus] = useState<Status>('OPEN');
  const q = useQuery<Complaint[]>(`hostels.complaints.${status}`, '/hostel-complaints', { status });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Hostel complaints" subtitle="Complaints about university and private hostels." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(Object.keys(LABEL) as Status[]).map((s) => <Chip key={s} label={LABEL[s]} selected={status === s} onPress={() => setStatus(s)} />)}</View>
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="Nothing here" why={status === 'OPEN' ? 'No new complaints.' : 'No complaints with this status.'} /> : <>{list.map((c) => <ComplaintCard key={c.id} c={c} onDone={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function ComplaintCard({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const { space } = useTheme();
  const [to, setTo] = useState<Status | null>(null);
  const [note, setNote] = useState(c.officeNote ?? '');
  const { busy, error, run } = useSubmit();
  const needsNote = to === 'RESOLVED' || to === 'DISMISSED';
  return (
    <Card>
      <Text variant="label">{c.hostel.name}: {c.category.toLowerCase().replace(/_/g, ' ')}</Text>
      <Badge label={LABEL[c.status]} />
      <Text>{c.description}</Text>
      <Text variant="small" tone="muted">{c.student ? `${c.student.firstName} ${c.student.lastName}` : 'Anonymous'}, {new Date(c.createdAt).toLocaleDateString()}</Text>
      {c.ownerResponse ? <Text variant="small">Owner: {c.ownerResponse}</Text> : null}
      <FormError error={error} />
      {to ? (
        <View style={{ gap: space.sm }}>
          <TextField label={needsNote ? 'What was done (the student sees it)' : 'Note (optional)'} value={note} onChangeText={setNote} multiline error={needsNote && note.trim().length < 5 ? 'At least 5 characters.' : null} />
          <Button label={LABEL[to]} disabled={needsNote && note.trim().length < 5} loading={busy} onPress={() => void run(async () => { await axiosInstance.post(`/hostel-complaints/${c.id}/handle`, { status: to, note: note.trim() || undefined }); setTo(null); onDone(); })} />
          <Button label="Cancel" variant="ghost" onPress={() => setTo(null)} />
        </View>
      ) : c.status === 'OPEN' || c.status === 'IN_REVIEW' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {c.status === 'OPEN' ? <Button label="Take into review" variant="secondary" onPress={() => setTo('IN_REVIEW')} /> : null}
          <Button label="Resolve" onPress={() => setTo('RESOLVED')} />
          <Button label="Dismiss" variant="ghost" onPress={() => setTo('DISMISSED')} />
        </View>
      ) : c.officeNote ? <Text variant="small">Office: {c.officeNote}</Text> : null}
    </Card>
  );
}
