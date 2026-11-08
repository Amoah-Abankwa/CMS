import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { suggestIndexCode } from '@anu/shared';
import { registryApi, type DepartmentRow, type ProgrammeRow, type ProgrammeType, type SchoolRow } from '@/api/registry';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export type Target = { kind: 'school'; s: SchoolRow | null } | { kind: 'department'; d: DepartmentRow | null; schoolId: string } | { kind: 'programme'; p: ProgrammeRow | null; departmentId: string };

/** Adding or changing a school, department or programme, each field checked inline. */
export function StructureForm({ t, types, onDone }: { t: Target; types: ProgrammeType[]; onDone: () => void }) {
  const { space } = useTheme();
  const cur = t.kind === 'school' ? t.s : t.kind === 'department' ? t.d : t.p;
  const [f, setF] = useState({ code: cur?.code ?? '', name: cur?.name ?? '', levelCode: t.kind === 'programme' ? t.p?.levelCode ?? types.find((x) => x.isActive)?.code ?? '' : '', indexCode: t.kind === 'programme' ? t.p?.indexCode ?? '' : '', isActive: t.kind === 'programme' ? t.p?.isActive ?? true : true });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const type = types.find((x) => x.code === f.levelCode);
  const errs = {
    code: /^[A-Z0-9-]{2,20}$/.test(f.code) ? null : 'Letters, numbers or dashes, 2 to 20 characters (e.g. CSC or BSC-CS).',
    name: f.name.trim().length >= 3 ? null : 'Give it a name of at least 3 letters.',
    indexCode: t.kind === 'programme' && type?.usesProgrammeCode && !/^[A-Z][A-Z0-9]{1,5}$/.test(f.indexCode) ? 'Starts every index number on the programme: 2 to 6 capitals and digits, e.g. DCE.' : null,
  };
  const save = () => {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    void run(async () => {
      if (t.kind === 'school') await registryApi.saveSchool({ code: f.code, name: f.name.trim() }, t.s?.id);
      else if (t.kind === 'department') await registryApi.saveDepartment({ code: f.code, name: f.name.trim(), schoolId: t.schoolId }, t.d?.id);
      else await registryApi.saveProgramme({ code: f.code, name: f.name.trim(), departmentId: t.departmentId, levelCode: f.levelCode, indexCode: type?.usesProgrammeCode ? f.indexCode : null, isActive: f.isActive }, t.p?.id);
      onDone();
    });
  };
  return (
    <Card>
      <Text variant="heading">{cur ? 'Edit' : 'Add'} {t.kind}</Text>
      <FormError error={error} />
      <TextField label="Code" value={f.code} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, code: x.toUpperCase() })} error={touched ? errs.code : null} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      {t.kind === 'programme' ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label">Programme type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {types.filter((x) => x.isActive || x.code === f.levelCode).map((x) => <Chip key={x.code} label={x.name} selected={f.levelCode === x.code} onPress={() => setF({ ...f, levelCode: x.code })} />)}
          </ScrollView>
          {type ? <Text variant="small" tone="muted">{type.semesters} semesters. Index numbers like {type.example ?? type.indexFormat}.</Text> : null}
          {type?.usesProgrammeCode ? <TextField label="Index code" value={f.indexCode} autoCapitalize="characters" placeholder={suggestIndexCode(f.name) || 'DCE'} onChangeText={(x) => setF({ ...f, indexCode: x.toUpperCase() })} error={touched ? errs.indexCode : null} hint="Cannot be changed once students have numbers." /> : null}
          <Chip label={f.isActive ? 'Admitting new students' : 'Not admitting'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} />
        </View>
      ) : null}
      <Button label="Save" loading={busy} onPress={save} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
