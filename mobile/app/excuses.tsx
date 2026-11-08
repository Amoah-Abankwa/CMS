import { useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { uploadDocument, type PickedFile } from '@/lib/upload';
import { useTheme } from '@/theme/useTheme';

type Category = 'MEDICAL' | 'BEREAVEMENT' | 'OFFICIAL_DUTY' | 'OTHER';
const CATEGORY: Record<Category, string> = { MEDICAL: 'Illness', BEREAVEMENT: 'Bereavement', OFFICIAL_DUTY: 'University duty', OTHER: 'Other' };
const STATUS: Record<string, [string, 'warning' | 'success' | 'danger' | 'neutral']> = { PENDING: ['Waiting for a decision', 'warning'], APPROVED: ['Approved', 'success'], REJECTED: ['Not approved', 'danger'], WITHDRAWN: ['Withdrawn', 'neutral'] };
interface Req { id: string; fromDate: string; toDate: string; category: Category; statement: string; status: string; decisionNote: string | null }
const today = () => new Date().toISOString().slice(0, 10);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Asking to be excused from classes, with a medical note when ill (a photo or a PDF). */
export default function Excuses() {
  const { space } = useTheme();
  const q = useQuery<Req[]>('me.excuses', '/me/excuse-requests');
  const draft = useDraft('excuse.new', { fromDate: today(), toDate: today(), category: 'MEDICAL' as Category, statement: '' });
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  const v = draft.value;
  const errs = {
    from: touched && !isDate(v.fromDate) ? 'Write the date as YYYY-MM-DD.' : null,
    to: touched && (!isDate(v.toDate) || v.toDate < v.fromDate) ? 'The last day must be a date on or after the first day.' : null,
    statement: touched && v.statement.trim().length < 10 ? 'Say briefly what happened (at least 10 characters).' : null,
    file: fileError ?? (touched && v.category === 'MEDICAL' && !file ? 'Add the medical note: a clear photo or the PDF from the clinic.' : null),
  };
  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    if (a.size && a.size > 10 * 1024 * 1024) { setFile(null); setFileError(`${a.name} is ${(a.size / 1024 / 1024).toFixed(1)} MB. Choose a file under 10 MB, or take a smaller photo.`); return; }
    setFileError(null);
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
  };
  const send = () => {
    setTouched(true);
    const invalid = !isDate(v.fromDate) || !isDate(v.toDate) || v.toDate < v.fromDate || v.statement.trim().length < 10 || (v.category === 'MEDICAL' && !file) || !!fileError;
    if (invalid) return;
    void run(async () => {
      const doc = file ? await uploadDocument('EXCUSE', file) : null;
      await axiosInstance.post('/me/excuse-requests', { fromDate: v.fromDate, toDate: v.toDate, category: v.category, statement: v.statement.trim(), documentId: doc?.id });
      draft.clear(); setFile(null); setTouched(false); setSent(true); q.refresh();
    });
  };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Excuse requests" subtitle="Missed classes for a good reason? Ask to be excused." />
      {sent ? <SuccessState title="Request sent" reassurance="Your request and any document went to your department." next="You will get a notification with the decision. Approved days do not count against your attendance." action={{ label: 'Done', onPress: () => setSent(false) }} /> : (
        <Card>
          <FormError error={error} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(Object.keys(CATEGORY) as Category[]).map((c) => <Chip key={c} label={CATEGORY[c]} selected={v.category === c} onPress={() => draft.set('category', c)} />)}
          </View>
          <TextField label="First day" value={v.fromDate} onChangeText={(x) => draft.set('fromDate', x)} placeholder="YYYY-MM-DD" error={errs.from} />
          <TextField label="Last day" value={v.toDate} onChangeText={(x) => draft.set('toDate', x)} placeholder="YYYY-MM-DD" error={errs.to} />
          <TextField label="What happened" value={v.statement} onChangeText={(x) => draft.set('statement', x)} multiline style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }} error={errs.statement ?? error?.fields.statement} />
          <Button label={file ? `Change document (${file.name})` : `Add document${v.category === 'MEDICAL' ? '' : ' (optional)'}`} variant="secondary" onPress={() => void pick()} />
          {errs.file ? <Text variant="small" tone="danger">{errs.file}</Text> : <Text variant="small" tone="muted">PDF, JPG or PNG, up to 10 MB. Only your department and the Registry can open it.</Text>}
          <Button label="Send request" loading={busy} onPress={send} />
        </Card>
      )}
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="No requests yet" why="Requests you send appear here with the decision." /> : <>{list.map((r) => (
          <Card key={r.id}>
            <Text variant="label">{CATEGORY[r.category]}: {r.fromDate.slice(0, 10)} to {r.toDate.slice(0, 10)}</Text>
            <Badge label={STATUS[r.status]?.[0] ?? r.status} tone={STATUS[r.status]?.[1] ?? 'neutral'} />
            {r.decisionNote ? <Text variant="small" tone="muted">{r.decisionNote}</Text> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
