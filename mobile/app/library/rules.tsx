import { useState } from 'react';
import { View } from 'react-native';
import type { LibraryPolicy } from '@anu/shared';
import { libraryApi } from '@/api/library';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { DAYS } from '@/lib/hours';
import { useTheme } from '@/theme/useTheme';

const whole = (v: string, min: number, max: number) => (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? null : `A whole number from ${min} to ${max}.`);
const cedis = (v: string) => (Number(v) >= 0 && v !== '' ? null : 'An amount in cedis.');

export default function LibraryRules() {
  const q = useQuery<LibraryPolicy>('lib.policy', '/library/policy');
  return (
    <Screen>
      <Header title="Library rules" />
      <QueryView q={q} skeleton={<SkeletonCard lines={8} />}>{(p) => <Form p={p} onSaved={q.refresh} />}</QueryView>
    </Screen>
  );
}

function Form({ p, onSaved }: { p: LibraryPolicy; onSaved: () => void }) {
  const { space } = useTheme();
  const s = (n: number) => String(n);
  const [f, setF] = useState({ sDays: s(p.student.loanDays), sItems: s(p.student.maxItems), sRenew: s(p.student.maxRenewals), tDays: s(p.staff.loanDays), tItems: s(p.staff.maxItems), tRenew: s(p.staff.maxRenewals), fine: s(p.finePerDay / 100), grace: s(p.graceDays), maxFine: s(p.maxFinePerItem / 100), block: s(p.blockAtFines / 100), lost: s(p.lostItemFee / 100), hold: s(p.holdDays), maxRes: s(p.maxReservations), remind: s(p.dueReminderDays), closed: p.closedDays });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs: Record<string, string | null> = { sDays: whole(f.sDays, 1, 180), sItems: whole(f.sItems, 1, 50), sRenew: whole(f.sRenew, 0, 10), tDays: whole(f.tDays, 1, 365), tItems: whole(f.tItems, 1, 100), tRenew: whole(f.tRenew, 0, 10), fine: cedis(f.fine), grace: whole(f.grace, 0, 14), maxFine: cedis(f.maxFine), block: cedis(f.block), lost: cedis(f.lost), hold: whole(f.hold, 1, 14), maxRes: whole(f.maxRes, 1, 20), remind: whole(f.remind, 0, 14) };
  const field = (k: keyof typeof f, label: string) => <TextField key={k} label={label} value={f[k] as string} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, [k]: x })} error={errs[k]} />;
  if (saved) return <SuccessState title="Rules saved" reassurance="New loans and fines follow them." next="Books already out keep their due dates." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      <Card><Text variant="heading">Students</Text>{field('sDays', 'Loan days')}{field('sItems', 'Books at once')}{field('sRenew', 'Renewals')}</Card>
      <Card><Text variant="heading">Staff</Text>{field('tDays', 'Loan days')}{field('tItems', 'Books at once')}{field('tRenew', 'Renewals')}</Card>
      <Card><Text variant="heading">Fines</Text>{field('fine', 'Fine per day late (GH₵)')}{field('grace', 'Days of grace before fining')}{field('maxFine', 'Most fine for one book (GH₵)')}{field('block', 'Stop borrowing when fines reach (GH₵)')}{field('lost', 'Fee for a lost book, on top of its price (GH₵)')}</Card>
      <Card>
        <Text variant="heading">Reservations and reminders</Text>
        {field('hold', 'Days a reserved book waits')}{field('maxRes', 'Reservations at once')}{field('remind', 'Reminder this many days before due')}
        <Text variant="label">Closed days (due dates move to the next open day)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{DAYS.map((d, i) => <Chip key={d} label={d.slice(0, 3)} selected={f.closed.includes(i)} onPress={() => setF({ ...f, closed: f.closed.includes(i) ? f.closed.filter((x) => x !== i) : [...f.closed, i].sort() })} />)}</View>
      </Card>
      <Button label="Save rules" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => {
        const c = (v: string) => Math.round(Number(v) * 100);
        await libraryApi.setPolicy({ ...p, student: { loanDays: Number(f.sDays), maxItems: Number(f.sItems), maxRenewals: Number(f.sRenew) }, staff: { loanDays: Number(f.tDays), maxItems: Number(f.tItems), maxRenewals: Number(f.tRenew) }, finePerDay: c(f.fine), graceDays: Number(f.grace), maxFinePerItem: c(f.maxFine), blockAtFines: c(f.block), lostItemFee: c(f.lost), holdDays: Number(f.hold), maxReservations: Number(f.maxRes), dueReminderDays: Number(f.remind), closedDays: f.closed });
        setSaved(true); onSaved();
      })} />
    </View>
  );
}
