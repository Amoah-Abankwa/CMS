import { useState } from 'react';
import { View } from 'react-native';
import { CATEGORY_LABEL, MODE_LABEL, registryApi, type Category, type Mode, type ProgrammeType } from '@/api/registry';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
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

export default function ProgrammeTypes() {
  const q = useQuery<{ types: ProgrammeType[] }>('registry.structure.types', '/registry/structure');
  const [editing, setEditing] = useState<ProgrammeType | 'new' | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Programme types" subtitle="How long each kind of programme runs, and how its index numbers look." />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => editing ? <TypeForm t={editing === 'new' ? null : editing} onDone={() => { setEditing(null); q.refresh(); }} /> : (
          <>
            <Button label="Add a programme type" onPress={() => setEditing('new')} />
            {d.types.map((t) => (
              <Card key={t.code} style={{ padding: 12 }}>
                <Text variant="label">{t.name} ({t.code}){t.isActive ? '' : ', not in use'}</Text>
                <Text variant="small" tone="muted">{CATEGORY_LABEL[t.category]}, {MODE_LABEL[t.mode].toLowerCase()}. {t.semesters} semesters. Index numbers like {t.example ?? t.indexFormat}. {t._count.programmes} programmes.</Text>
                <Button label="Edit" variant="ghost" onPress={() => setEditing(t)} />
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function TypeForm({ t, onDone }: { t: ProgrammeType | null; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ code: t?.code ?? '', name: t?.name ?? '', category: (t?.category ?? 'BACHELORS') as Category, mode: (t?.mode ?? 'REGULAR') as Mode, semesters: String(t?.semesters ?? 8), indexFormat: t?.indexFormat ?? 'ANU{YY}{CODE}{SEQ:5}', isActive: t?.isActive ?? true });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = {
    code: /^[A-Z0-9]{1,6}$/.test(f.code) ? null : '1 to 6 capitals or digits.',
    name: f.name.trim().length >= 3 ? null : 'At least 3 letters.',
    semesters: Number.isInteger(Number(f.semesters)) && Number(f.semesters) >= 1 && Number(f.semesters) <= 24 ? null : 'From 1 to 24.',
    indexFormat: /\{SEQ(:\d)?\}/.test(f.indexFormat) ? null : 'Must include {SEQ:5} (the running number). Also usable: {YY}, {YYYY}, {CODE}, {PROG}.',
  };
  return (
    <Card>
      <FormError error={error} />
      <TextField label="Code" value={f.code} editable={!t} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, code: x.toUpperCase() })} error={touched ? errs.code : null} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <Chip key={c} label={CATEGORY_LABEL[c]} selected={f.category === c} onPress={() => setF({ ...f, category: c })} />)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(Object.keys(MODE_LABEL) as Mode[]).map((m) => <Chip key={m} label={MODE_LABEL[m]} selected={f.mode === m} onPress={() => setF({ ...f, mode: m })} />)}</View>
      <TextField label="Semesters" value={f.semesters} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, semesters: x })} error={touched ? errs.semesters : null} />
      <TextField label="Index number format" value={f.indexFormat} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, indexFormat: x })} error={touched ? errs.indexFormat : null} hint="Regular and weekend Bachelor's can share a format (and so one sequence), e.g. ANU{YY}4{SEQ:5}." />
      <Chip label={f.isActive ? 'In use' : 'Not in use'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} />
      <Button label="Save" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await registryApi.saveType({ code: f.code, name: f.name.trim(), category: f.category, mode: f.mode, semesters: Number(f.semesters), indexFormat: f.indexFormat.trim(), isActive: f.isActive }, t?.code); onDone(); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
