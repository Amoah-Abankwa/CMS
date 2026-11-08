import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { registryApi, type ProgrammeType, type SchoolRow } from '@/api/registry';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { StructureForm, type Target } from '@/features/registry/StructureForm';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export default function Structure() {
  const { space, colors } = useTheme();
  const q = useQuery<{ schools: SchoolRow[]; types: ProgrammeType[] }>('registry.structure', '/registry/structure');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Target | null>(null);
  const { busy, error, run } = useSubmit();
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Academic structure" subtitle="Schools, their departments, and the programmes each runs." />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => editing ? <StructureForm t={editing} types={d.types} onDone={() => { setEditing(null); q.refresh(); }} /> : (
          <>
            <Button label="Add school" onPress={() => setEditing({ kind: 'school', s: null })} />
            {d.schools.length === 0 ? <EmptyState title="No schools yet" why="Add the first school, then its departments and programmes." /> : d.schools.map((s) => (
              <Card key={s.id}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open.has(s.id) }} onPress={() => toggle(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Ionicons name={open.has(s.id) ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.muted} />
                  <Text variant="heading" style={{ flex: 1 }}>{s.name} ({s.code})</Text>
                  <Text variant="small" tone="muted">{s.departments.length} departments</Text>
                </Pressable>
                {open.has(s.id) ? (
                  <View style={{ gap: space.sm }}>
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <View style={{ flex: 1 }}><Button label="Edit school" variant="ghost" onPress={() => setEditing({ kind: 'school', s })} /></View>
                      <View style={{ flex: 1 }}><Button label="Add department" variant="secondary" onPress={() => setEditing({ kind: 'department', d: null, schoolId: s.id })} /></View>
                    </View>
                    {s.departments.map((dep) => (
                      <Card key={dep.id} style={{ padding: 10 }}>
                        <Text variant="label">{dep.name} ({dep.code})</Text>
                        <Text variant="small" tone="muted">{dep.programmes.length} programmes, {dep._count.courses} courses, {dep._count.staff} staff.</Text>
                        {dep.programmes.map((p) => (
                          <Pressable key={p.id} onPress={() => setEditing({ kind: 'programme', p, departmentId: dep.id })} accessibilityRole="button">
                            <Text variant="small">{p.name} ({p.code}{p.indexCode ? `, index code ${p.indexCode}` : ''}). {p._count.students} students. {p.isActive ? '' : 'Not admitting.'}</Text>
                          </Pressable>
                        ))}
                        <View style={{ flexDirection: 'row', gap: space.sm }}>
                          <View style={{ flex: 1 }}><Button label="Add programme" variant="secondary" onPress={() => setEditing({ kind: 'programme', p: null, departmentId: dep.id })} /></View>
                          <View style={{ flex: 1 }}><Button label="Edit" variant="ghost" onPress={() => setEditing({ kind: 'department', d: dep, schoolId: s.id })} /></View>
                        </View>
                        {dep.programmes.length === 0 && dep._count.staff === 0 ? <Button label="Remove department" variant="ghost" loading={busy} onPress={() => void run(async () => { await registryApi.deleteDepartment(dep.id); q.refresh(); })} /> : null}
                      </Card>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
            <Badge label="Tap a programme to edit it" />
          </>
        )}
      </QueryView>
    </Screen>
  );
}
