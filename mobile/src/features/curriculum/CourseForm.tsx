import { useState } from 'react';
import { ScrollView } from 'react-native';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Course } from './types';

export function CourseForm({ c, departments, onDone }: { c: Course | null; departments: Array<{ id: string; name: string }>; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ code: c?.code ?? '', title: c?.title ?? '', creditHours: String(c?.creditHours ?? 3), departmentId: c?.department.id ?? '', isActive: c?.isActive ?? true });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { code: /^[A-Za-z]{2,5}\s?\d{3}[A-Za-z]?$/.test(f.code.trim()) ? null : 'A course code looks like CSC 101.', title: f.title.trim().length >= 3 ? null : 'At least 3 letters.', credits: Number.isInteger(Number(f.creditHours)) && Number(f.creditHours) >= 0 && Number(f.creditHours) <= 12 ? null : 'Whole credits from 0 to 12.', dept: f.departmentId ? null : 'Choose the department that teaches it.' };
  return (
    <Card>
      <Text variant="heading">{c ? `Edit ${c.code}` : 'Add a course'}</Text>
      <FormError error={error} />
      <TextField label="Code" value={f.code} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, code: x })} error={touched ? errs.code ?? error?.fields.code : null} />
      <TextField label="Title" value={f.title} onChangeText={(x) => setF({ ...f, title: x })} error={touched ? errs.title : null} />
      <TextField label="Credit hours" value={f.creditHours} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, creditHours: x })} error={touched ? errs.credits : null} />
      <Text variant="label">Taught by</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{departments.map((d) => <Chip key={d.id} label={d.name} selected={f.departmentId === d.id} onPress={() => setF({ ...f, departmentId: d.id })} />)}</ScrollView>
      {touched && errs.dept ? <Text variant="small" tone="danger">{errs.dept}</Text> : null}
      {c ? <Chip label={f.isActive ? 'Active' : 'Inactive'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} /> : null}
      <Button label="Save" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { const body = { code: f.code.trim(), title: f.title.trim(), creditHours: Number(f.creditHours), departmentId: f.departmentId, isActive: f.isActive }; if (c) await axiosInstance.patch(`/curriculum/courses/${c.id}`, body); else await axiosInstance.post('/curriculum/courses', body); onDone(); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
