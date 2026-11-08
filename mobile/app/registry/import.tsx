import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { IMPORT_FIELDS, matchColumns, parseCsv, type ImportType } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

const TYPES: Array<[ImportType, string]> = [['STRUCTURE', 'Structure'], ['COURSES', 'Courses'], ['STAFF', 'Staff'], ['STUDENTS', 'Students'], ['RESULTS', 'Past results']];
const CHUNK = 200;
type Result = { row: number; action: 'create' | 'update' | 'skip' | 'error'; messages: string[] };
interface Batch { id: string; type: ImportType; fileName: string; totalRows: number; created: number; updated: number; failed: number; createdAt: string; awaitingSetup: number }

/** Importing from the previous system: pick a CSV, match columns, check, then import, with real progress. */
export default function DataImport() {
  const { space } = useTheme();
  const history = useQuery<Batch[]>('import.history', '/imports');
  const [type, setType] = useState<ImportType>('STRUCTURE');
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Result[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'checked' | 'importing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [mapping, setMapping] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const { error, run } = useSubmit();
  const fields = IMPORT_FIELDS[type];
  const missing = fields.filter((f) => f.required && map[f.key] === undefined);
  const records = useMemo(() => (file ? file.rows.map((r) => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, r[i] ?? '']))) : []), [file, map]);
  const errors = results?.filter((r) => r.action === 'error') ?? [];

  const pick = async () => {
    setFileError(null); setResults(null); setPhase('idle');
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const rows = parseCsv(await new File(r.assets[0].uri).text());
    if (rows.length < 2) { setFileError(`${r.assets[0].name} has no rows under its headings. Save the sheet as CSV with a heading row first.`); return; }
    setFile({ name: r.assets[0].name, headers: rows[0], rows: rows.slice(1).filter((x) => x.some((c) => c.trim())) });
    setMap(matchColumns(type, rows[0]));
  };
  const go = (commit: boolean) => void run(async () => {
    if (!file) return;
    setPhase(commit ? 'importing' : 'checking'); setProgress(0);
    try {
      const batch = (await axiosInstance.post<{ id: string }>('/imports', { type, fileName: file.name, totalRows: records.length })).data;
      const out: Result[] = [];
      for (let i = 0; i < records.length; i += CHUNK) {
        out.push(...(await axiosInstance.post<Result[]>(`/imports/${batch.id}/rows`, { rows: records.slice(i, i + CHUNK), startRow: i + 2, commit })).data);
        setProgress(Math.min(records.length, i + CHUNK));
      }
      if (commit) { await axiosInstance.post(`/imports/${batch.id}/finish`); history.refresh(); }
      setResults(out); setPhase(commit ? 'done' : 'checked');
    } catch (e) { setPhase(commit ? 'checked' : 'idle'); throw e; }
  });

  return (
    <Screen refreshing={history.loading} onRefresh={history.refresh}>
      <Header title="Import data" subtitle="From the previous system, in this order: structure, courses, staff, students, past results." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {TYPES.map(([t, l], i) => <Chip key={t} label={`${i + 1}. ${l}`} selected={type === t} onPress={() => { setType(t); setFile(null); setResults(null); setPhase('idle'); }} />)}
      </ScrollView>
      <Card>
        <FormError error={error} />
        {fileError ? <Text variant="small" tone="danger">{fileError}</Text> : null}
        <Button label={file ? `Change file (${file.name}, ${file.rows.length} rows)` : 'Choose a CSV file'} variant="secondary" onPress={() => void pick()} />
        {file ? (
          <>
            <Text variant="label">Columns</Text>
            {fields.map((f) => (
              <View key={f.key} style={{ gap: 4 }}>
                <Text variant="small" tone={f.required && map[f.key] === undefined ? 'danger' : 'default'}>{f.label}{f.required ? '' : ' (optional)'}: {map[f.key] !== undefined ? file.headers[map[f.key]] : f.required ? 'not found, choose its column' : 'not used'}</Text>
                {mapping === f.key ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                    {file.headers.map((h, i) => <Chip key={`${h}${i}`} label={h || `Column ${i + 1}`} selected={map[f.key] === i} onPress={() => { setMap({ ...map, [f.key]: i }); setMapping(null); }} />)}
                    {!f.required ? <Chip label="Not used" onPress={() => { const m = { ...map }; delete m[f.key]; setMap(m); setMapping(null); }} /> : null}
                  </ScrollView>
                ) : <Button label="Change" variant="ghost" onPress={() => setMapping(f.key)} />}
              </View>
            ))}
          </>
        ) : null}
      </Card>
      {phase === 'checking' || phase === 'importing' ? (
        <Card>
          <Text variant="label">{phase === 'checking' ? 'Checking' : 'Importing'} row {progress} of {records.length}</Text>
          <ProgressBar value={records.length ? progress / records.length : 0} />
          <Text variant="small" tone="muted">Keep the app open. Rows go up {CHUNK} at a time.</Text>
        </Card>
      ) : null}
      {file && phase !== 'checking' && phase !== 'importing' ? (
        <>
          {missing.length ? <Notice tone="warning" title="Choose the missing columns">{missing.map((f) => f.label).join(', ')}.</Notice> : null}
          <Button label="Check the file (changes nothing)" variant="secondary" disabled={missing.length > 0} onPress={() => go(false)} />
          {phase === 'checked' ? (errors.length ? <Notice tone="danger" title={`${errors.length} rows need fixing`}>Fix them in the sheet and check again. The others are fine.</Notice> : <Button label={`Import ${records.length} rows`} onPress={() => go(true)} />) : null}
        </>
      ) : null}
      {phase === 'done' && results ? <SuccessState title="Import finished" reassurance={`${results.filter((r) => r.action === 'create').length} created, ${results.filter((r) => r.action === 'update').length} updated, ${results.filter((r) => r.action === 'skip').length} unchanged.`} next={type === 'STAFF' || type === 'STUDENTS' ? 'Send the new accounts their set-up emails from the list below.' : 'Go on to the next import.'} action={{ label: 'Import another file', onPress: () => { setFile(null); setResults(null); setPhase('idle'); } }} /> : null}
      {errors.slice(0, 50).map((r) => <Text key={r.row} variant="small" tone="danger">Row {r.row}: {r.messages.join(' ')}</Text>)}
      <QueryView q={history} skeleton={<SkeletonList rows={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="No imports yet" why="Imports you finish are listed here." /> : <>{list.map((b) => (
          <Card key={b.id} style={{ padding: 10 }}>
            <Text variant="label">{b.fileName}</Text>
            <Text variant="small" tone="muted">{b.type.toLowerCase()}, {new Date(b.createdAt).toLocaleDateString()}: {b.created} created, {b.updated} updated, {b.failed} failed.</Text>
            {b.awaitingSetup > 0 ? <Button label={`Email set-up links to ${b.awaitingSetup}`} variant="secondary" onPress={() => void run(async () => { await axiosInstance.post(`/imports/${b.id}/setup-links`); history.refresh(); })} /> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
