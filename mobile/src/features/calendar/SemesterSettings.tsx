import { useState } from 'react';
import { View } from 'react-native';
import { termName } from '@anu/shared';
import { academicsApi, type Semester } from '@/api/academics';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const toLocal = (iso: string | null | undefined) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');
const fromLocal = (v: string) => (v.trim() ? new Date(v.trim().replace(' ', 'T')).toISOString() : null);
const okDateTime = (v: string) => !v.trim() || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v.trim());

/** One semester's registration window, drop deadline, credit limits and whether it is current. */
export function SemesterSettings({ s, onSaved }: { s: Semester & { summerKind?: 'PROMOTIONAL' | 'UPGRADE' | null }; onSaved: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ opens: toLocal(s.registrationOpensAt), closes: toLocal(s.registrationClosesAt), drop: toLocal(s.dropDeadline), min: String(s.minCredits), max: String(s.maxCredits) });
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSubmit();
  const dtError = 'Write as YYYY-MM-DD HH:MM, e.g. 2026-09-01 08:00, or leave empty.';
  const errs = { opens: okDateTime(f.opens) ? null : dtError, closes: okDateTime(f.closes) ? (f.opens && f.closes && f.closes <= f.opens ? 'Closing must be after opening.' : null) : dtError, drop: okDateTime(f.drop) ? null : dtError, credits: !(Number(f.min) >= 0 && Number(f.max) >= Number(f.min) && Number(f.max) <= 40) ? 'Minimum from 0, maximum at least the minimum and at most 40.' : null };
  return (
    <Card style={{ padding: 12 }}>
      <Text variant="label">{termName(s.number)}{s.isCurrent ? ' (current)' : ''}{s.registrationOpen ? ', registration open' : ''}</Text>
      <Text variant="small" tone="muted">{s.minCredits} to {s.maxCredits} credits.</Text>
      <FormError error={error} />
      {s.number === 3 ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Promotional summer" selected={s.summerKind === 'PROMOTIONAL'} onPress={() => void run(async () => { await academicsApi.setSummerKind(s.id, 'PROMOTIONAL'); onSaved(); })} />
          <Chip label="Upgrade summer" selected={s.summerKind === 'UPGRADE'} onPress={() => void run(async () => { await academicsApi.setSummerKind(s.id, 'UPGRADE'); onSaved(); })} />
        </View>
      ) : null}
      {!open ? <Button label="Change settings" variant="ghost" onPress={() => setOpen(true)} /> : (
        <View style={{ gap: space.sm }}>
          <TextField label="Registration opens" value={f.opens} onChangeText={(x) => setF({ ...f, opens: x })} placeholder="2026-09-01 08:00" error={errs.opens} />
          <TextField label="Registration closes" value={f.closes} onChangeText={(x) => setF({ ...f, closes: x })} error={errs.closes} />
          <TextField label="Students can ask to drop courses until" value={f.drop} onChangeText={(x) => setF({ ...f, drop: x })} error={errs.drop} hint="Empty keeps dropping closed." />
          <TextField label="Minimum credits" value={f.min} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, min: x })} />
          <TextField label="Maximum credits" value={f.max} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, max: x })} error={errs.credits} />
          <Button label="Save" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await academicsApi.updateSemester(s.id, { registrationOpensAt: fromLocal(f.opens), registrationClosesAt: fromLocal(f.closes), dropDeadline: fromLocal(f.drop), minCredits: Number(f.min), maxCredits: Number(f.max) }); setOpen(false); onSaved(); })} />
          {!s.isCurrent ? <Button label="Make this the current semester" variant="secondary" loading={busy} onPress={() => void run(async () => { await academicsApi.updateSemester(s.id, { isCurrent: true }); setOpen(false); onSaved(); })} /> : null}
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      )}
    </Card>
  );
}
