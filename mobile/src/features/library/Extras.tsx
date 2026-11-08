import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

interface ReadingList { id: string; course: { code: string; title: string }; items: Array<{ id: string; citation: string | null; importance: 'ESSENTIAL' | 'RECOMMENDED'; note: string | null; title: { id: string; title: string; authors: string[] } | null }> }
interface Clearance { clear: boolean; reasons: string[]; certificate: { certificateNumber: string; createdAt: string } | null }
interface Ill { id: string; title: string; authors: string | null; status: string; dueDate: string | null; librarianNote: string | null }
const ILL: Record<string, string> = { REQUESTED: 'Requested', ORDERED: 'Ordered', ARRIVED: 'Arrived: collect at the desk', ON_LOAN: 'With you', RETURNED: 'Returned', REJECTED: 'Not possible' };

export function ReadingLists() {
  const q = useQuery<ReadingList[]>('me.readingLists', '/me/library/reading-lists');
  return (
    <QueryView q={q} skeleton={<SkeletonCard lines={4} />}>
      {(lists) => lists.length === 0 ? <EmptyState title="No reading lists" why="Your lecturers have not added reading lists for this term's courses yet." /> : <>{lists.map((l) => (
        <Card key={l.id}>
          <Text variant="heading">{l.course.code} {l.course.title}</Text>
          {l.items.map((i) => (
            <View key={i.id} style={{ gap: 2 }}>
              <Text variant="label">{i.title?.title ?? i.citation}</Text>
              {i.title ? <Text variant="small" tone="muted">{i.title.authors.join(', ')}</Text> : null}
              <Badge label={i.importance === 'ESSENTIAL' ? 'Essential' : 'Recommended'} tone={i.importance === 'ESSENTIAL' ? 'primary' : 'neutral'} />
            </View>
          ))}
        </Card>
      ))}</>}
    </QueryView>
  );
}

export function ClearanceAndRequests() {
  const { space } = useTheme();
  const c = useQuery<Clearance>('me.libraryClearance', '/me/library/clearance');
  const ill = useQuery<Ill[]>('me.ill', '/me/library/ill');
  const draft = useDraft('library.ill', { title: '', authors: '', note: '' });
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  const titleError = touched && draft.value.title.trim().length < 3 ? 'Give the title of the book (at least 3 letters).' : null;
  return (
    <View style={{ gap: space.md }}>
      <QueryView q={c} skeleton={<SkeletonCard lines={2} />}>
        {(d) => d.clear ? <Notice tone="success" title="You are cleared by the library">{d.certificate ? `Certificate ${d.certificate.certificateNumber}.` : 'Nothing owed and nothing out.'}</Notice> : <Notice tone="warning" title="Not cleared yet">{d.reasons.join(' ')}</Notice>}
      </QueryView>
      <Text variant="heading">Book from another library</Text>
      {sent ? <SuccessState title="Request sent" reassurance="The librarian will try to get it from a partner library." next="You will get a notification when it arrives or if it cannot be found." action={{ label: 'Request another', onPress: () => setSent(false) }} /> : (
        <Card>
          <FormError error={error} />
          <TextField label="Title" value={draft.value.title} onChangeText={(v) => draft.set('title', v)} onBlur={() => setTouched(true)} error={titleError ?? error?.fields.title} />
          <TextField label="Author (optional)" value={draft.value.authors} onChangeText={(v) => draft.set('authors', v)} />
          <TextField label="Note (optional)" value={draft.value.note} onChangeText={(v) => draft.set('note', v)} placeholder="Edition, chapter, when you need it" />
          <Button label="Send request" loading={busy} onPress={() => {
            setTouched(true);
            if (draft.value.title.trim().length < 3) return;
            void run(async () => { await axiosInstance.post('/me/library/ill', { title: draft.value.title.trim(), authors: draft.value.authors.trim() || undefined, note: draft.value.note.trim() || undefined }); draft.clear(); setTouched(false); setSent(true); ill.refresh(); });
          }} />
        </Card>
      )}
      <QueryView q={ill} skeleton={null}>
        {(list) => <>{list.map((r) => (
          <Card key={r.id}>
            <Text variant="label">{r.title}</Text>
            <Badge label={ILL[r.status] ?? r.status} tone={r.status === 'ARRIVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'neutral'} />
            {r.librarianNote ? <Text variant="small" tone="muted">{r.librarianNote}</Text> : null}
          </Card>
        ))}</>}
      </QueryView>
    </View>
  );
}
