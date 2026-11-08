import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { libraryApi, type TitleDetail, type TitleInput, type TitleRow } from '@/api/library';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
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
import { useTheme } from '@/theme/useTheme';

export default function Catalogue() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TitleRow[] | null>(null);
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const { busy, error, run } = useSubmit();
  useEffect(() => {
    if (search.trim().length < 2) { setRows(null); return; }
    const t = setTimeout(() => void run(async () => setRows((await libraryApi.search({ search: search.trim(), page: 1, pageSize: 30 })).items)), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen>
      <Header title="Catalogue" subtitle="Titles and their copies." />
      {open === 'new' ? <TitleForm t={null} onDone={(id) => setOpen(id ?? null)} /> : open ? <Title id={open} onBack={() => setOpen(null)} /> : (
        <>
          <Button label="Add a title" onPress={() => setOpen('new')} />
          <TextField label="Find a title" value={search} onChangeText={setSearch} placeholder="Title, author, ISBN or subject" />
          <FormError error={error} />
          {rows === null ? (busy ? <SkeletonList rows={4} /> : null) : rows.length === 0 ? <EmptyState title={`Nothing matches "${search}"`} why="Check the spelling, or add the title." /> : rows.map((t) => (
            <Card key={t.id} style={{ padding: 10 }}>
              <Text variant="label">{t.title}</Text>
              <Text variant="small" tone="muted">{t.authors.join(', ')}. {t.copies} copies, {t.available} on the shelf.</Text>
              <Button label="Open" variant="ghost" onPress={() => setOpen(t.id)} />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function Title({ id, onBack }: { id: string; onBack: () => void }) {
  const { space } = useTheme();
  const q = useQuery<TitleDetail>(`lib.title.${id}`, `/library/catalogue/${id}`);
  const [editing, setEditing] = useState(false);
  const [barcodes, setBarcodes] = useState('');
  const [shelf, setShelf] = useState('');
  const [reference, setReference] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const list = barcodes.split(/[\s,;]+/).filter(Boolean);
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
      {(t) => editing ? <TitleForm t={t} onDone={() => { setEditing(false); q.refresh(); }} /> : (
        <View style={{ gap: space.md }}>
          <Button label="Back to search" variant="ghost" onPress={onBack} />
          <Card>
            <Text variant="heading">{t.title}</Text>
            <Text variant="small" tone="muted">{t.authors.join(', ')}{t.year ? `, ${t.year}` : ''}{t.callNumber ? `. Shelf mark ${t.callNumber}` : ''}</Text>
            <Button label="Edit details" variant="ghost" onPress={() => setEditing(true)} />
          </Card>
          <FormError error={error} />
          {msg ? <Notice tone="success">{msg}</Notice> : null}
          {t.copies.map((c) => (
            <Card key={c.id} style={{ padding: 10 }}>
              <Text variant="label">{c.barcode}{c.shelf ? `, ${c.shelf}` : ''}{c.isReference ? ', reference only' : ''}</Text>
              {c.loans[0] ? <Text variant="small">With {c.loans[0].borrower.firstName} {c.loans[0].borrower.lastName}, due {new Date(c.loans[0].dueAt).toLocaleDateString()}</Text> : <Badge label={c.status.toLowerCase().replace('_', ' ')} />}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {(['AVAILABLE', 'DAMAGED', 'WITHDRAWN'] as const).filter((s) => s !== c.status && !c.loans[0]).map((s) => <Button key={s} label={s === 'AVAILABLE' ? 'Back on the shelf' : s === 'DAMAGED' ? 'Damaged' : 'Withdraw'} variant="ghost" loading={busy} onPress={() => void run(async () => { await libraryApi.updateCopy(c.id, { status: s }); q.refresh(); })} />)}
              </View>
            </Card>
          ))}
          <Card>
            <Text variant="heading">Add copies</Text>
            <TextField label="Barcodes" value={barcodes} autoCapitalize="characters" multiline onChangeText={setBarcodes} placeholder="ANUL000123 ANUL000124" />
            <TextField label="Shelf (optional)" value={shelf} onChangeText={setShelf} />
            <Chip label={reference ? 'Reference only (not lent)' : 'Can be borrowed'} selected={reference} onPress={() => setReference(!reference)} />
            <Button label={`Add ${list.length || ''} copies`.trim()} disabled={!list.length} loading={busy} onPress={() => void run(async () => { await libraryApi.addCopies(t.id, list.map((b) => b.toUpperCase()), shelf.trim() || undefined, reference); setMsg(`${list.length} copies added.`); setBarcodes(''); q.refresh(); })} />
          </Card>
        </View>
      )}
    </QueryView>
  );
}

function TitleForm({ t, onDone }: { t: TitleDetail | null; onDone: (id?: string) => void }) {
  const [f, setF] = useState({ title: t?.title ?? '', authors: t?.authors.join('; ') ?? '', isbn: t?.isbn ?? '', publisher: t?.publisher ?? '', year: t?.year ? String(t.year) : '', edition: t?.edition ?? '', callNumber: t?.callNumber ?? '', subjects: t?.subjects.join('; ') ?? '' });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { title: f.title.trim().length >= 2 ? null : 'Enter the title.', authors: f.authors.trim() ? null : 'At least one author, separated by semicolons.', isbn: !f.isbn || /^[\d-]{10,17}X?$/i.test(f.isbn.trim()) ? null : 'An ISBN has 10 or 13 digits.', year: !f.year || (Number(f.year) >= 1450 && Number(f.year) <= new Date().getFullYear() + 1) ? null : 'A year like 2019.' };
  const split = (v: string) => v.split(';').map((x) => x.trim()).filter(Boolean);
  return (
    <Card>
      <Text variant="heading">{t ? 'Edit title' : 'Add a title'}</Text>
      <FormError error={error} />
      <TextField label="Title" value={f.title} onChangeText={(x) => setF({ ...f, title: x })} error={touched ? errs.title : null} />
      <TextField label="Authors (separate with ;)" value={f.authors} onChangeText={(x) => setF({ ...f, authors: x })} error={touched ? errs.authors : null} />
      <TextField label="ISBN (optional)" value={f.isbn} onChangeText={(x) => setF({ ...f, isbn: x })} error={touched ? errs.isbn : null} />
      <TextField label="Publisher (optional)" value={f.publisher} onChangeText={(x) => setF({ ...f, publisher: x })} />
      <TextField label="Year (optional)" value={f.year} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, year: x })} error={touched ? errs.year : null} />
      <TextField label="Edition (optional)" value={f.edition} onChangeText={(x) => setF({ ...f, edition: x })} />
      <TextField label="Shelf mark (optional)" value={f.callNumber} onChangeText={(x) => setF({ ...f, callNumber: x })} />
      <TextField label="Subjects (separate with ;)" value={f.subjects} onChangeText={(x) => setF({ ...f, subjects: x })} />
      <Button label="Save" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => {
        const dto: TitleInput = { title: f.title.trim(), authors: split(f.authors), isbn: f.isbn.trim() || undefined, publisher: f.publisher.trim() || undefined, year: f.year ? Number(f.year) : undefined, edition: f.edition.trim() || undefined, callNumber: f.callNumber.trim() || undefined, subjects: split(f.subjects) };
        if (t) { await libraryApi.saveTitle(dto, t.id); onDone(); } else { const r = await libraryApi.saveTitle(dto) as { id: string }; onDone(r.id); }
      }); }} />
      <Button label="Cancel" variant="ghost" onPress={() => onDone(t?.id)} />
    </Card>
  );
}
