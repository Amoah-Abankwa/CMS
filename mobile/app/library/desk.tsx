import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { libraryApi, type BorrowerRow, type BorrowerSummary } from '@/api/library';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The circulation desk: find a borrower and lend, or take a book back. */
export default function Desk() {
  const { space } = useTheme();
  const [mode, setMode] = useState<'lend' | 'return'>('lend');
  return (
    <Screen>
      <Header title="Circulation desk" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Lend" selected={mode === 'lend'} onPress={() => setMode('lend')} />
        <Chip label="Return" selected={mode === 'return'} onPress={() => setMode('return')} />
      </View>
      {mode === 'lend' ? <Lend /> : <Return />}
    </Screen>
  );
}

function Lend() {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<BorrowerRow[] | null>(null);
  const [who, setWho] = useState<BorrowerSummary | null>(null);
  const [barcode, setBarcode] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const pick = (id: string) => void run(async () => { setWho(await libraryApi.borrower(id)); setFound(null); });
  if (who) {
    const b = who.borrower;
    return (
      <>
        <Card>
          <Text variant="heading">{b.firstName} {b.lastName}</Text>
          <Text variant="small" tone="muted">{b.indexNumber ?? b.staffProfile?.staffNumber}. {who.loans.length} out, {formatCedis(who.owed)} owed.</Text>
          {who.blocks.length ? <Notice tone="warning" title="Cannot borrow">{who.blocks.join(' ')}</Notice> : null}
          {who.loans.map((l) => <Text key={l.id} variant="small" tone={l.overdueDays ? 'danger' : 'default'}>{l.copy.title.title}: due {day(l.dueAt)}{l.overdueDays ? ` (${l.overdueDays} days late)` : ''}</Text>)}
        </Card>
        <FormError error={error} />
        {note ? <Notice tone="success">{note}</Notice> : null}
        {!who.blocks.length ? (
          <Card>
            <TextField label="Book barcode" value={barcode} autoCapitalize="characters" autoCorrect={false} onChangeText={setBarcode} placeholder="ANUL000123" />
            <Button label="Lend" disabled={barcode.trim().length < 4} loading={busy} onPress={() => void run(async () => {
              const r = await libraryApi.issue(b.id, barcode.trim().toUpperCase());
              setNote(`Lent "${r.title}", due ${day(r.dueAt)}.`); setBarcode(''); setWho(await libraryApi.borrower(b.id));
            })} />
          </Card>
        ) : null}
        <Button label="Next borrower" variant="ghost" onPress={() => { setWho(null); setQ(''); setNote(null); }} />
      </>
    );
  }
  return (
    <>
      <TextField label="Find the borrower" value={q} onChangeText={setQ} placeholder="Index number, staff number, name or email" autoCorrect={false} onSubmitEditing={() => q.trim().length >= 2 && void run(async () => setFound(await libraryApi.lookup(q.trim())))} />
      <Button label="Find" disabled={q.trim().length < 2} loading={busy} onPress={() => void run(async () => setFound(await libraryApi.lookup(q.trim())))} />
      <FormError error={error} />
      {found === null ? null : busy ? <SkeletonList rows={3} /> : found.length === 0 ? <EmptyState title={`No one matches "${q}"`} why="Check the index or staff number on their ID card, or search by surname." /> : found.map((p) => (
        <Card key={p.id}>
          <Text variant="label">{p.firstName} {p.lastName}</Text>
          <Text variant="small" tone="muted">{p.indexNumber ?? p.staffProfile?.staffNumber ?? p.email}</Text>
          <Button label="Choose" variant="secondary" onPress={() => pick(p.id)} />
        </Card>
      ))}
    </>
  );
}

function Return() {
  const [barcode, setBarcode] = useState('');
  const [last, setLast] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <Card>
      <TextField label="Book barcode" value={barcode} autoCapitalize="characters" autoCorrect={false} onChangeText={setBarcode} placeholder="ANUL000123" />
      <FormError error={error} />
      {last ? <Notice tone="success">{last}</Notice> : null}
      <Button label="Take back" disabled={barcode.trim().length < 4} loading={busy} onPress={() => void run(async () => {
        const r = await libraryApi.returnCopy(barcode.trim().toUpperCase());
        setLast(`"${r.title}" returned by ${r.borrower.firstName} ${r.borrower.lastName}.${r.daysLate ? ` ${r.daysLate} days late: fine ${formatCedis(r.fine)}.` : ''}${r.heldFor ? ` Put it aside for ${r.heldFor}, who reserved it.` : ''}`);
        setBarcode('');
      })} />
    </Card>
  );
}
